# PYTH Sells Analytics — Design Spec

**Date:** 2026-03-27
**Branch:** feature/sells-page
**Status:** Approved

---

## Overview

Enhance the `/sells` page with:
1. Renamed tiers (shrimp / dolphin / whale) with updated thresholds
2. A "Sell Pressure Analytics" section with two Recharts pie charts
3. Tier filter buttons on the activity feed
4. Rename activity feed to "Notable Sells"

---

## 1. Tier Rename + Thresholds

| Tier | Threshold | Stored | Shown in Feed | Shown in Charts |
|---|---|---|---|---|
| shrimp | < 10K PYTH | Yes | No | Yes |
| dolphin | 10K – 50K PYTH | Yes | Yes | Yes |
| whale | > 50K PYTH | Yes | Yes + whale cards | Yes |

**Changes from current tiers:**
- `minor` → `shrimp` (same threshold: < 10K)
- `significant` (10K–100K) + `large` (100K–1M) → merged into `dolphin` (10K–50K) + `whale` (50K+)
- Old `whale` (1M+) → now simply `whale` (50K+)

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
  dolphin: v.number(),
  whale: v.number(),
})
```

Shrimp sells are stored in `sell_events` with `tier = "shrimp"` but excluded from `sells_daily` aggregates (same as current "minor" behaviour). This keeps daily aggregates focused on impactful sell pressure.

### `sell_events.tier`

Values change from `"minor" | "significant" | "large" | "whale"` to `"shrimp" | "dolphin" | "whale"`. The field type remains `v.string()` — no schema migration needed for the field itself, only the `byTier` object.

---

## 3. Convex Changes

### `convex/sellsUtils.ts`

- `Tier` type: `"shrimp" | "dolphin" | "whale"`
- `assignTier`: updated thresholds (shrimp < 10K, dolphin 10K–50K, whale > 50K)

### `convex/sells.ts`

**`storeSellEvent` mutation:**
- Skip `sells_daily` update when `tier === "shrimp"` (unchanged from current "minor" behaviour)
- `byTier` object uses `{ dolphin, whale }` keys

**`getSellEvents` query (updated):**
- Accepts optional `tier: v.optional(v.string())` arg
- When `tier` provided: uses `by_tier_and_timestamp` compound index for efficient filtered pagination
- When `tier` is undefined (All): uses `by_timestamp` index, filters out `shrimp` via `.filter()`

```ts
export const getSellEvents = query({
  args: { paginationOpts: paginationOptsValidator, tier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.tier) {
      return await ctx.db
        .query("sell_events")
        .withIndex("by_tier_and_timestamp", (q) => q.eq("tier", args.tier!))
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
- Reads from `sells_daily` with optional date range filter
- Returns event counts and PYTH volume broken down by tier (dolphin + whale)
- For shrimp: queries `sell_events` directly via `by_tier_and_timestamp` index (shrimp not in sells_daily)

```ts
// Returns:
{
  eventCount: { shrimp: number, dolphin: number, whale: number },
  pythVolume: { shrimp: number, dolphin: number, whale: number },
}
```

**Note on shrimp in analytics:** Since shrimp are excluded from `sells_daily`, the analytics query fetches shrimp counts separately from `sell_events` using `by_tier_and_timestamp`. This is an intentional trade-off — shrimp volume is tracked for analytics display but excluded from daily aggregates.

**`getWhaleSellEvents` query (updated):**
- No logic change — still queries `by_tier_and_timestamp` with `tier === "whale"`
- Now captures all sells > 50K (was > 1M implicitly via old "whale" tier)

---

## 4. Frontend Components

### New: `components/sells/sells-analytics.tsx`

- `"use client"` component
- `useQuery(api.sells.getSellsAnalytics, { window })` where `window` is local state
- Time window dropdown: **30d** (default) / 7d / All-time
- Two `PieChart` components from Recharts side by side:
  - **Left — "Sell Events"**: event count per tier as percentage
  - **Right — "PYTH Volume"**: PYTH sold per tier as percentage
- Color coding: shrimp = `#6366f1` (indigo), dolphin = `#f59e0b` (amber), whale = `#ef4444` (red)
- Recharts `Tooltip` with custom formatter showing exact count/volume + percentage
- Shows skeleton loader while data loads
- Shows empty state if no data yet

### Updated: `components/sells/sell-activity-feed.tsx`

- Rename heading from "Activity Feed" to "Notable Sells"
- Accept `tierFilter: "all" | "dolphin" | "whale"` prop (default: `"all"`)
- Pass tier to `usePaginatedQuery`: `tier: tierFilter === "all" ? undefined : tierFilter`
- No other changes to the row rendering

### New: `components/sells/sells-tier-filter.tsx`

- Three toggle buttons: **All** / **Dolphin** / **Whale**
- Controlled component: accepts `value` and `onChange` props
- Active button: filled background; inactive: ghost style
- Shrimp excluded (not shown in feed)

### Updated: `app/sells/page.tsx`

- Add `tierFilter` state: `useState<"all" | "dolphin" | "whale">("all")`
- Page layout (top to bottom):
  1. Hero header (unchanged)
  2. **Sell Pressure Analytics** section — `<SellsAnalytics />`
  3. Whale Cards (unchanged)
  4. Notable Sells section — `<SellsTierFilter />` + `<SellActivityFeed tierFilter={tierFilter} />`

---

## 5. Testing

### `convex/sellsUtils.test.ts` — updated assignTier tests
- shrimp: `assignTier(1)` → `"shrimp"`, `assignTier(9_999)` → `"shrimp"`
- dolphin: `assignTier(10_000)` → `"dolphin"`, `assignTier(50_000)` → `"dolphin"`
- whale: `assignTier(50_001)` → `"whale"`, `assignTier(5_000_000)` → `"whale"`

No new test files needed — `getSellsAnalytics` is a Convex query (not unit-testable with Vitest directly).

---

## 6. Migration Note

Any existing `sell_events` rows in the database will have old tier values (`minor`, `significant`, `large`). These won't match the new tier names in queries. Since this is a development tracker (not production with real user data), the simplest fix is to clear the `sell_events` and `sells_daily` tables from the Convex dashboard after deploying the tier rename. Fresh data will use the new tier names.

---

## 7. File Map

| File | Action |
|---|---|
| `convex/schema.ts` | Modify — update `sells_daily.byTier` keys |
| `convex/sellsUtils.ts` | Modify — rename tiers, update thresholds |
| `convex/sellsUtils.test.ts` | Modify — update assignTier tests |
| `convex/sells.ts` | Modify — update storeSellEvent, getSellEvents, add getSellsAnalytics |
| `components/sells/sells-analytics.tsx` | Create — two pie charts + dropdown |
| `components/sells/sells-tier-filter.tsx` | Create — All/Dolphin/Whale toggle |
| `components/sells/sell-activity-feed.tsx` | Modify — accept tierFilter prop, rename heading |
| `app/sells/page.tsx` | Modify — add analytics section, tier filter state, rename feed heading |
