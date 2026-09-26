/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { buildBuybackHistoryChartModel } from "../lib/buyback/history";

const modules = import.meta.glob("../convex/**/*.ts");
const day = Date.UTC(2026, 8, 20);
const hour = 3_600_000;

async function setup(timestamps: number[]) {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const timestampMs of timestamps) {
      await ctx.db.insert("pythBuybackSnapshots", {
        timestampMs,
        minuteBucketMs: Math.floor(timestampMs / 60_000) * 60_000,
        totalPythBought: timestampMs - day + 1000.123,
        totalUsdcSpent: timestampMs - day + 123.456,
        avgBuyPriceUsd: 0.123456789,
      });
    }
  });
  return t;
}

describe("daily indexed buyback history", () => {
  it("preserves the baseline, exact daily closes, gaps, and latest totals across UTC midnight", async () => {
    const timestamps = [day + hour, day + 23 * hour, day + 24 * hour,
      day + 47 * hour, day + 72 * hour, day + 73 * hour];
    // Insert out of order so selection must use timestamps, not insertion order.
    const t = await setup([...timestamps].reverse());
    const result = await t.query(api.pythBuybackSnapshots.getPythBuybackHistory, {});
    expect(result.map((x) => x.timestampMs)).toEqual([
      timestamps[0], timestamps[1], timestamps[3], timestamps[5],
    ]);
    const original = await t.run((ctx) => ctx.db.query("pythBuybackSnapshots")
      .withIndex("by_timestampMs").order("asc").collect());
    const oldModel = buildBuybackHistoryChartModel(original);
    const newModel = buildBuybackHistoryChartModel(result);
    expect(newModel.latestPythBought).toBe(oldModel.latestPythBought);
    expect(newModel.pythBoughtSinceTracking).toBe(oldModel.pythBoughtSinceTracking);
    expect(newModel.firstTrackedTimestampMs).toBe(oldModel.firstTrackedTimestampMs);
    expect(newModel.latestTrackedTimestampMs).toBe(oldModel.latestTrackedTimestampMs);
    expect(result.at(-1)?.totalUsdcSpent).toBe(original.at(-1)?.totalUsdcSpent);
    expect(result.at(-1)?.avgBuyPriceUsd).toBe(original.at(-1)?.avgBuyPriceUsd);
    // Corrections to a retained day's closing snapshot must remain visible.
    await t.run(async (ctx) => {
      const close = original.find((x) => x.timestampMs === timestamps[3])!;
      await ctx.db.patch(close._id, { totalPythBought: 5555.987 });
    });
    const corrected = await t.query(api.pythBuybackSnapshots.getPythBuybackHistory, {});
    expect(corrected.find((x) => x.timestampMs === timestamps[3])?.totalPythBought).toBe(5555.987);
    expect(await t.run((ctx) => ctx.db.query("pythBuybackSnapshots").collect())).toHaveLength(6);
  });

  it("returns baseline and latest once for a single day", async () => {
    const t = await setup([day, day + hour, day + 2 * hour]);
    const result = await t.query(api.pythBuybackSnapshots.getPythBuybackHistory, {});
    expect(result.map((x) => x.timestampMs)).toEqual([day, day + 2 * hour]);
  });

  it("does not duplicate a single snapshot and handles empty history", async () => {
    const empty = await setup([]);
    expect(await empty.query(api.pythBuybackSnapshots.getPythBuybackHistory, {})).toEqual([]);
    const single = await setup([day]);
    expect(await single.query(api.pythBuybackSnapshots.getPythBuybackHistory, {})).toHaveLength(1);
  });
});
