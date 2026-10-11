/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import {
  buildPriceFeedChart, fetchPriceFeedCounts, parsePriceFeedCounts, PRICE_FEED_COUNTS_URL,
  PRICE_FEED_DAY_MS, totalPriceFeeds,
} from "../lib/growth/priceFeeds";

const modules = import.meta.glob("../convex/**/*.ts");
const counts = { stable: 1883, comingSoon: 1193, inactive: 777 };
const state = [
  { value: "coming_soon", count: counts.comingSoon },
  { value: "inactive", count: counts.inactive },
  { value: "stable", count: counts.stable },
];
const day = Date.UTC(2026, 9, 11);
const collectedAt = day + (4 * 60 + 15) * 60_000;
const response = () => new Response(JSON.stringify({ state }), { headers: { "Content-Type": "application/json" } });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("public Pyth feed counters", () => {
  it("reads unordered public counters and derives the combined total", () => {
    expect(parsePriceFeedCounts({ state, coverage: [] })).toEqual(counts);
    expect(totalPriceFeeds(counts)).toBe(3853);
  });

  it.each([
    undefined, {}, { state: null }, { state: [] }, { state: state.slice(1) },
    { state: [...state, state[0]] }, { state: [null] },
    ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, "1883"].map(count => ({ state: [...state.slice(0, 2), { value: "stable", count }] })),
    { state: state.map(row => ({ ...row, count: 0 })) },
    { state: [...state, { value: "expired", count: 1 }] },
  ])("rejects incomplete, malformed, empty, or newly unsupported counters", payload => {
    expect(() => parsePriceFeedCounts(payload)).toThrow();
  });

  it("accepts a genuine zero for one status and unused additional statuses", () => {
    expect(parsePriceFeedCounts({ state: [...state.slice(1), { value: "coming_soon", count: 0 }, { value: "expired", count: 0 }] }))
      .toEqual({ ...counts, comingSoon: 0 });
  });

  it("fetches JSON without a key or cookies", async () => {
    const fetcher = vi.fn().mockResolvedValue(response());
    expect(await fetchPriceFeedCounts(fetcher)).toEqual(counts);
    expect(fetcher).toHaveBeenCalledWith(PRICE_FEED_COUNTS_URL, {
      headers: { Accept: "application/json" }, signal: expect.any(AbortSignal),
    });
  });

  it.each([new Response("error", { status: 503 }), new Response("<html>Loading</html>")])("rejects HTTP errors and loading HTML", async result => {
    await expect(fetchPriceFeedCounts(vi.fn().mockResolvedValue(result))).rejects.toThrow();
  });

  it("aborts a hung request after 15 seconds", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
    }));
    const pending = expect(fetchPriceFeedCounts(fetcher)).rejects.toThrow("Aborted");
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
  });
});

describe("daily price-feed history", () => {
  it("retains one first-success snapshot per UTC date", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.pythPriceFeeds.store, { ...counts, collectedAt });
    await t.mutation(internal.pythPriceFeeds.store, { ...counts, stable: 1900, collectedAt: collectedAt + 60_000 });
    expect(await t.query(api.pythPriceFeeds.latest, {})).toEqual({ ...counts, date: "2026-10-11", collectedAt });
    expect(await t.query(api.pythPriceFeeds.history, { since: "0000-01-01", paginationOpts: { numItems: 10, cursor: null } }))
      .toMatchObject({ isDone: true, page: [{ ...counts, date: "2026-10-11", collectedAt }] });
    expect(await t.query(internal.pythPriceFeeds.hasDate, { date: "2026-10-11" })).toBe(true);
    expect(await t.query(internal.pythPriceFeeds.hasDate, { date: "2026-10-12" })).toBe(false);
  });

  it("uses UTC dates across midnight and orders history by date rather than insertion", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.pythPriceFeeds.store, { ...counts, collectedAt: day });
    await t.mutation(internal.pythPriceFeeds.store, { ...counts, collectedAt: day - 1 });
    const first = await t.query(api.pythPriceFeeds.history, { since: "2026-10-10", paginationOpts: { numItems: 1, cursor: null } });
    expect(first.page.map(row => row.date)).toEqual(["2026-10-10"]);
    const second = await t.query(api.pythPriceFeeds.history, { since: "2026-10-10", paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect(second.page.map(row => row.date)).toEqual(["2026-10-11"]);
    expect((await t.query(api.pythPriceFeeds.latest, {}))?.date).toBe("2026-10-11");
  });

  it("returns null and empty history before the first collection", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.pythPriceFeeds.latest, {})).toBeNull();
    expect((await t.query(api.pythPriceFeeds.history, { since: "2026-10-11", paginationOpts: { numItems: 30, cursor: null } })).page).toEqual([]);
  });

  it("rejects invalid storage input and calendar dates", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.pythPriceFeeds.store, { ...counts, stable: -1, collectedAt })).rejects.toThrow();
    await expect(t.mutation(internal.pythPriceFeeds.store, { ...counts, collectedAt: 0 })).rejects.toThrow();
    await expect(t.query(api.pythPriceFeeds.history, { since: "2026-02-30", paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow();
    expect(await t.query(api.pythPriceFeeds.latest, {})).toBeNull();
  });

  it("breaks chart lines across missed days without creating zero counts", () => {
    const chart = buildPriceFeedChart([
      { ...counts, date: "2026-10-11", collectedAt },
      { ...counts, stable: 1885, date: "2026-10-13", collectedAt: collectedAt + 2 * PRICE_FEED_DAY_MS },
    ]);
    expect(chart).toEqual([
      { time: day, ...counts, total: 3853 },
      { time: day + PRICE_FEED_DAY_MS, stable: null, comingSoon: null, inactive: null, total: null },
      { time: day + 2 * PRICE_FEED_DAY_MS, ...counts, stable: 1885, total: 3855 },
    ]);
  });
});

describe("daily collection and retries", () => {
  it("collects once and skips repeated manual or cron runs", async () => {
    vi.useFakeTimers(); vi.setSystemTime(collectedAt);
    const fetcher = vi.fn().mockImplementation(response);
    vi.stubGlobal("fetch", fetcher);
    const t = convexTest(schema, modules);
    await t.action(internal.pythPriceFeedCollection.collect, {});
    await t.action(internal.pythPriceFeedCollection.collect, {});
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await t.query(api.pythPriceFeeds.latest, {})).toEqual({ ...counts, date: "2026-10-11", collectedAt });
  });

  it("preserves the previous day after failure, then stores a successful retry", async () => {
    vi.useFakeTimers(); vi.setSystemTime(collectedAt);
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 })).mockImplementation(response);
    vi.stubGlobal("fetch", fetcher);
    const t = convexTest(schema, modules);
    await t.mutation(internal.pythPriceFeeds.store, { ...counts, collectedAt: collectedAt - PRICE_FEED_DAY_MS });
    await t.action(internal.pythPriceFeedCollection.collect, {});
    expect((await t.query(api.pythPriceFeeds.latest, {}))?.date).toBe("2026-10-10");
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await t.query(api.pythPriceFeeds.latest, {}))?.date).toBe("2026-10-11");
  });

  it("bounds persistent failures to three attempts with no false snapshot", async () => {
    vi.useFakeTimers(); vi.setSystemTime(collectedAt);
    const fetcher = vi.fn().mockImplementation(() => new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    const t = convexTest(schema, modules);
    await t.action(internal.pythPriceFeedCollection.collect, {});
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(await t.query(api.pythPriceFeeds.latest, {})).toBeNull();
  });

  it("skips retries delayed into a different UTC day", async () => {
    vi.useFakeTimers(); vi.setSystemTime(collectedAt);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const t = convexTest(schema, modules);
    await t.action(internal.pythPriceFeedCollection.collect, { date: "2026-10-10", attempt: 1 });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await t.query(api.pythPriceFeeds.latest, {})).toBeNull();
  });
});
