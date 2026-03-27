# PYTH Sells Analytics — Design Spec

**Date:** 2026-03-27
**Branch:** feature/sells-page
**Status:** Approved

---

## Overview

Enhance the `/sells` page with:
1. Renamed tiers (shrimp / dolphin / whale) with updated thresholds
2. A "Sell Pressure Analytics" section with two Recharts pie charts
3. Tier filter buttons on the activity feed (renamed "Notable Sells")

---

## 1. Tier Rename + Thresholds

| Tier | Threshold | Stored | Shown in Feed | Shown in Charts |
|---|---|---|---|---|
| shrimp | < 10K PYTH (exclusive) | Yes | No | Yes |
| dolphin | 10K – 50K PYTH (inclusive both ends) | Yes | Yes | Yes |
| whale | > 50K PYTH (exclusive) | Yes | Yes + whale cards | Yes |

**Boundary clarification:** `assignTier(50_000)` → `"dolphin"`, `assignTier(50_001)` → `"whale"`.

**`assignTier` logic:**
```ts
if (pythAmount > 50_000) return "whale";
if (pythAmount >= 10_000) return "dolphin";
return "shrimp";
```

---

## 2. Schema Changes

### `sells_daily.byTier`

Change from:
```ts
byTier: v.object({
  significant: v.number(),
  large: v.number(),
  whale: v.number(),
})
```

To:
```ts
byTier: v.object({
  shrimp: v.number(),
  dolphin: v.number(),
  whale: v.number(),
}),
pythVolumeByTier: v.object({
  dolphin: v.number(),
  whale: v.number(),
}),
```

`pythVolumeByTier` stores cumulative PYTH sold per tier per day — dolphin and whale only (shrimp volume is noise and excluded from charts). This makes `getSellsAnalytics` read only from `sells_daily` for both counts and volume, avoiding any `sell_events` scans and staying well within Convex's 16,384-document read limit.

**Migration note:** This is a breaking schema change. Any existing `sells_daily` and `sell_events` rows contain old tier names (`minor`, `significant`, `large`) that will fail Convex's schema validator on read or write. **Both `sell_events` and `sells_daily` tables must be manually cleared from the Convex dashboard before deploying this change.**

---

## 3. Convex Changes

### `convex/sellsUtils.ts`

- `Tier` type: `"shrimp" | "dolphin" | "whale"`
- `assignTier`: updated thresholds as shown above
- Tests updated: add shrimp boundary tests, update dolphin/whale boundaries

### `convex/sells.ts`

**`storeSellEvent` mutation (updated):**
- Remove the `if (args.tier === "minor") return` guard — all tiers now update `sells_daily`
- `byTier` uses `{ shrimp, dolphin, whale }` for event counts
- `pythVolumeByTier` uses `{ dolphin, whale }` for PYTH volume (shrimp excluded — noise)
- Shrimp increments `byTier.shrimp` only; does NOT touch `totalPythSold`, `eventCount`, or `pythVolumeByTier`

```ts
if (dailyRecord) {
  await ctx.db.patch(dailyRecord._id, {
    // totalPythSold and eventCount: dolphin+whale only (used by summary bar)
    totalPythSold: tierKey !== "shrimp"
      ? dailyRecord.totalPythSold + args.pythAmount
      : dailyRecord.totalPythSold,
    eventCount: tierKey !== "shrimp"
      ? dailyRecord.eventCount + 1
      : dailyRecord.eventCount,
    byTier: {
      ...dailyRecord.byTier,
      [tierKey]: dailyRecord.byTier[tierKey] + 1,
    },
    pythVolumeByTier: tierKey !== "shrimp"
      ? {
          ...dailyRecord.pythVolumeByTier,
          [tierKey]: dailyRecord.pythVolumeByTier[tierKey as "dolphin" | "whale"] + args.pythAmount,
        }
      : dailyRecord.pythVolumeByTier,
  });
} else {
  await ctx.db.insert("sells_daily", {
    date: dateKey,
    totalPythSold: tierKey !== "shrimp" ? args.pythAmount : 0,
    eventCount: tierKey !== "shrimp" ? 1 : 0,
    byTier: {
      shrimp: tierKey === "shrimp" ? 1 : 0,
      dolphin: tierKey === "dolphin" ? 1 : 0,
      whale: tierKey === "whale" ? 1 : 0,
    },
    pythVolumeByTier: {
      dolphin: tierKey === "dolphin" ? args.pythAmount : 0,
      whale: tierKey === "whale" ? args.pythAmount : 0,
    },
  });
}
```

**`getSellEvents` query (updated):**
- Accepts optional `tier: v.optional(v.string())` arg
- When `tier` provided: uses `by_tier_and_timestamp` compound index
- When `tier` undefined (All): uses `by_timestamp` index, filters out shrimp
- Note: Convex's `usePaginatedQuery` automatically resets to page 1 when args change — no manual reset needed on the frontend when `tierFilter` changes

```ts
export const getSellEvents = query({
  args: { paginationOpts: paginationOptsValidator, tier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tier = args.tier;
    if (tier) {
      return await ctx.db
        .query("sell_events")
        .withIndex("by_tier_and_timestamp", (q) => q.eq("tier", tier))
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("sell_events")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("tier"), "shrimp"))
      .paginate(args.paginationOpts);
  },
});
```

**`getSellsAnalytics` query (new):**
- Args: `{ window: v.union(v.literal("7d"), v.literal("30d"), v.literal("all")) }`
- Reads from `sells_daily` only — both event counts (`byTier`) and PYTH volume (`pythVolumeByTier`) are pre-aggregated there. No `sell_events` scan needed, stays well within Convex's 16,384-document read limit.
- Returns event counts (all three tiers) and PYTH volume (dolphin + whale only)

```ts
export const getSellsAnalytics = query({
  args: { window: v.union(v.literal("7d"), v.literal("30d"), v.literal("all")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart =
      args.window === "7d"
        ? toUtcDateKey(now - 6 * 24 * 60 * 60 * 1000)
        : args.window === "30d"
        ? toUtcDateKey(now - 29 * 24 * 60 * 60 * 1000)
        : "0000-00-00"; // all-time: lexicographic minimum — matches all stored dates

    const days = await ctx.db
      .query("sells_daily")
      .withIndex("by_date", (q) => q.gte("date", windowStart))
      .collect();

    return {
      eventCount: {
        shrimp: days.reduce((s, d) => s + d.byTier.shrimp, 0),
        dolphin: days.reduce((s, d) => s + d.byTier.dolphin, 0),
        whale: days.reduce((s, d) => s + d.byTier.whale, 0),
      },
      pythVolume: {
        dolphin: days.reduce((s, d) => s + d.pythVolumeByTier.dolphin, 0),
        whale: days.reduce((s, d) => s + d.pythVolumeByTier.whale, 0),
      },
    };
  },
});
```

**Note on charts:**
- Left pie (Event Count): shrimp + dolphin + whale
- Right pie (PYTH Volume): dolphin + whale only (shrimp < 10K sells are noise for pressure analysis)

**`getWhaleSellEvents` query (updated):**
- No logic change — still queries `by_tier_and_timestamp` with `tier === "whale"`
- Add `.take(20)` limit to prevent unbounded result sets at the lower 50K threshold

```ts
export const getWhaleSellEvents = query({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return await ctx.db
      .query("sell_events")
      .withIndex("by_tier_and_timestamp", (q) =>
        q.eq("tier", "whale").gte("timestamp", thirtyDaysAgo)
      )
      .order("desc")
      .take(20);
  },
});
```

---

## 4. Frontend Components

### New: `components/sells/sells-analytics.tsx`

- `"use client"` component
- Local state: `window: "7d" | "30d" | "all"`, default `"30d"`
- `useQuery(api.sells.getSellsAnalytics, { window })`
- Two `PieChart` components from Recharts side by side:
  - **Left — "Sell Events"**: event count per tier (shrimp / dolphin / whale) as percentage
  - **Right — "PYTH Volume"**: PYTH sold per tier (dolphin / whale only) as percentage
- Color coding: shrimp = `#6366f1` (indigo), dolphin = `#f59e0b` (amber), whale = `#ef4444` (red)
- Recharts `Tooltip` with custom formatter showing exact count/volume + percentage
- Time window dropdown: **30d** (default) / 7d / All-time
- Skeleton loader while data loads; empty state if no data yet

### New: `components/sells/sells-tier-filter.tsx`

- Three toggle buttons: **All** / **Dolphin** / **Whale**
- Controlled component: accepts `value: "all" | "dolphin" | "whale"` and `onChange` props
- Active button: filled background; inactive: ghost style
- Shrimp excluded (not shown in feed)

### Updated: `components/sells/sell-activity-feed.tsx`

- Accept `tierFilter: "all" | "dolphin" | "whale"` prop (default: `"all"`)
- Pass to query: `tier: tierFilter === "all" ? undefined : tierFilter`
- Update `TIER_STYLES` map: replace `significant` and `large` keys with `dolphin`; remove old keys
  ```ts
  const TIER_STYLES = {
    whale: { border: "border-l-red-500", badge: "...", label: "Whale" },
    dolphin: { border: "border-l-amber-500", badge: "...", label: "Dolphin" },
  } as const;
  ```
- Fallback for unknown tier: `TIER_STYLES.dolphin`
- Rename section heading: "Activity Feed" → "Notable Sells"

### Updated: `components/sells/whale-cards.tsx`

- No logic change
- Heading stays "Whale Events" (accurate — these are whale-tier sells)
- The `.take(20)` limit is enforced at the query level, not here

### Updated: `app/sells/page.tsx`

- Add `tierFilter` state: `useState<"all" | "dolphin" | "whale">("all")`
- Page layout (top to bottom):
  1. Hero header (unchanged)
  2. **Sell Pressure Analytics** section — `<SellsAnalytics />`
  3. Whale Cards (unchanged)
  4. "Notable Sells" section heading + `<SellsTierFilter value={tierFilter} onChange={setTierFilter} />` + `<SellActivityFeed tierFilter={tierFilter} />`

---

## 5. Testing

### `convex/sellsUtils.test.ts` — updated assignTier tests

```ts
it("returns shrimp for amounts under 10K", () => {
  expect(assignTier(1)).toBe("shrimp");
  expect(assignTier(9_999)).toBe("shrimp");
});
it("returns dolphin for 10K–50K (inclusive)", () => {
  expect(assignTier(10_000)).toBe("dolphin");
  expect(assignTier(50_000)).toBe("dolphin");
});
it("returns whale for over 50K", () => {
  expect(assignTier(50_001)).toBe("whale");
  expect(assignTier(5_000_000)).toBe("whale");
});
```

---

## 6. Migration Steps (required before deploying)

1. Deploy new Convex functions with updated schema
2. **Clear `sell_events` table** from Convex dashboard (old tier names are invalid)
3. **Clear `sells_daily` table** from Convex dashboard (old `byTier` shape is invalid)
4. Fresh events from Helius will populate with new tier names automatically

---

## 7. File Map

| File | Action |
|---|---|
| `convex/schema.ts` | Modify — update `sells_daily.byTier` to `{shrimp, dolphin, whale}` |
| `convex/sellsUtils.ts` | Modify — rename tiers, update thresholds |
| `convex/sellsUtils.test.ts` | Modify — update assignTier tests |
| `convex/sells.ts` | Modify — update storeSellEvent, getSellEvents, getWhaleSellEvents; add getSellsAnalytics |
| `components/sells/sells-analytics.tsx` | Create — two pie charts + dropdown |
| `components/sells/sells-tier-filter.tsx` | Create — All/Dolphin/Whale toggle |
| `components/sells/sell-activity-feed.tsx` | Modify — tierFilter prop, TIER_STYLES rename, heading rename |
| `components/sells/whale-cards.tsx` | Modify — no functional change (limit enforced at query level) |
| `app/sells/page.tsx` | Modify — add analytics section, tier filter state |
