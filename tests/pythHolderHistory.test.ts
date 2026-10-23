/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { HOLDER_EXCLUSION_KEY } from "../lib/growth/holderExclusions";
import { daysBefore } from "../lib/growth/holderRankings";
import { formatHolderTokens, holderHistoryChart, holderHistoryDomain } from "../lib/growth/holderHistory";
import { isolatedSnapshotTimes } from "../lib/growth/chartHistory";

const modules = import.meta.glob("../convex/**/*.ts");
const a = "1".repeat(32), b = "2".repeat(32), c = "3".repeat(32);
const at = (date: string) => Date.parse(`${date}T03:00:00Z`);
const snapshot = (date: string, entries = [{ owner: a, amount: "9007199254740993" }, { owner: b, amount: "6000000" }]) => ({
  eligibleHolders: 2, holders: 2, collectedAt: at(date), totalTokenAccounts: 4, positiveTokenAccounts: 3, topHolders: entries,
});

describe("selected holder history", () => {
  it("keeps missed days and missing owners unknown, matching by address when ranks change", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.pythHolders.store, snapshot("2026-10-01"));
    await t.mutation(internal.pythHolders.store, snapshot("2026-10-03", [{ owner: b, amount: "12000000" }, { owner: c, amount: "1000000" }]));
    await t.mutation(internal.pythHolders.store, snapshot("2026-10-04", [{ owner: a, amount: "9007199254740994" }, { owner: b, amount: "3000000" }]));
    const history = await t.query(api.pythHolderRankings.history, { owner: a, days: 7 });
    expect(history).toMatchObject({ owner: a, days: 7, date: "2026-10-04", collectedAt: at("2026-10-04") });
    expect(history!.points).toHaveLength(8);
    expect(history!.points.slice(0, 4).every(point => point.amount === null && point.collectedAt === null)).toBe(true);
    expect(history!.points.slice(4)).toEqual([
      { date: "2026-10-01", amount: "9007199254740993", collectedAt: at("2026-10-01") },
      { date: "2026-10-02", amount: null, collectedAt: null },
      { date: "2026-10-03", amount: null, collectedAt: at("2026-10-03") },
      { date: "2026-10-04", amount: "9007199254740994", collectedAt: at("2026-10-04") },
    ]);
    const other = await t.query(api.pythHolderRankings.history, { owner: b, days: 1 });
    expect(other!.points.map(point => point.amount)).toEqual(["12000000", "3000000"]);
  });

  it("anchors every period to stale stored data rather than the current clock", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.pythHolders.store, snapshot("2026-09-01"));
    await t.mutation(internal.pythHolders.store, snapshot("2026-10-01"));
    for (const days of [1, 7, 30] as const) {
      const history = await t.query(api.pythHolderRankings.history, { owner: a, days });
      expect(history!.points).toHaveLength(days + 1);
      expect(history!.points[0].date).toBe(daysBefore("2026-10-01", days));
      expect(history!.points.at(-1)!.date).toBe("2026-10-01");
      expect(history!.points.at(-1)!.amount).toBe("9007199254740993");
    }
  });

  it("does not mix incompatible collection policies or history before the comparison baseline", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.pythHolderRankings.history, { owner: a, days: 7 })).toBeNull();
    await t.mutation(internal.pythHolders.store, snapshot("2026-10-01"));
    await t.mutation(internal.pythHolders.store, snapshot("2026-10-02"));
    await t.mutation(internal.pythHolders.store, snapshot("2026-10-03"));
    await t.run(async ctx => {
      const old = await ctx.db.query("pythHolderRankingSnapshots").withIndex("by_date", q => q.eq("date", "2026-10-01")).unique();
      await ctx.db.patch(old!._id, { exclusionKey: "old-policy" });
      const latest = await ctx.db.query("pythHolderLeaderboard").first();
      await ctx.db.patch(latest!._id, { firstDate: "2026-10-03" });
    });
    const history = await t.query(api.pythHolderRankings.history, { owner: a, days: 7 });
    expect(history!.points.filter(point => point.amount !== null).map(point => point.date)).toEqual(["2026-10-03"]);
    await t.run(async ctx => {
      const latest = await ctx.db.query("pythHolderLeaderboard").first();
      await ctx.db.patch(latest!._id, { firstDate: "2026-10-01", exclusionKey: HOLDER_EXCLUSION_KEY });
    });
    expect((await t.query(api.pythHolderRankings.history, { owner: a, days: 7 }))!.points.at(-3)!.amount).toBeNull();
    await t.run(async ctx => {
      const latest = await ctx.db.query("pythHolderLeaderboard").first();
      await ctx.db.patch(latest!._id, { exclusionKey: "old-policy" });
    });
    expect(await t.query(api.pythHolderRankings.history, { owner: a, days: 7 })).toBeNull();
  });

  it("rejects malformed owners and unsupported ranges", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.pythHolderRankings.history, { owner: "invalid", days: 7 })).rejects.toThrow("Invalid holder address");
    // @ts-expect-error Public endpoint must reject requests beyond retained history.
    await expect(t.query(api.pythHolderRankings.history, { owner: a, days: 365 })).rejects.toThrow();
  });
});

describe("holder chart data", () => {
  it("preserves exact fractional balances above Number precision and leaves visible isolated points across gaps", () => {
    const points = [
      { date: "2026-10-01", amount: "9007199254740993", collectedAt: at("2026-10-01") },
      { date: "2026-10-02", amount: null, collectedAt: null },
      { date: "2026-10-03", amount: "9007199254740994", collectedAt: at("2026-10-03") },
    ];
    const chart = holderHistoryChart(points);
    expect(chart[1].balance).toBeNull();
    expect(chart[0].amount).toBe("9007199254740993");
    expect(formatHolderTokens(chart[0].amount!)).toBe("9,007,199,254.740993");
    expect(formatHolderTokens(chart[2].amount!)).toBe("9,007,199,254.740994");
    expect(formatHolderTokens("1")).toBe("0.000001");
    expect(formatHolderTokens("-1", true)).toBe("−0.000001");
    expect(isolatedSnapshotTimes(chart.filter(point => point.amount !== null)).size).toBe(2);
    const [min, max] = holderHistoryDomain([700_000_000, 700_000_000]);
    expect(min).toBeLessThan(700_000_000);
    expect(max).toBeGreaterThan(700_000_000);
    expect(holderHistoryDomain([0, 0])[0]).toBe(0);
  });
});
