# Sells Analytics Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the `/sells` page with tier renames (shrimp/dolphin/whale), a "Sell Pressure Analytics" section with two Recharts pie charts, and All/Dolphin/Whale filter buttons on the activity feed.

**Architecture:** Schema and Convex backend are updated first (new tier names, new `pythVolumeByTier` aggregates, new `getSellsAnalytics` query). Frontend components are then created/updated top-down: analytics charts, tier filter, activity feed, page layout. Tables must be cleared from the Convex dashboard after schema deploy.

**Tech Stack:** Convex (schema, internalMutation, query), Recharts (PieChart), React (useState), Vitest (tests), Next.js App Router

---

## Chunk 1: Backend

### Task 1: Update Convex schema

**Files:**
- Modify: `convex/schema.ts:101-111`

**Context:** `sells_daily` currently has `byTier: {significant, large, whale}`. Need to rename keys to `{shrimp, dolphin, whale}` and add `pythVolumeByTier: {dolphin, whale}`. This is a breaking change — tables must be cleared from the Convex dashboard after this deploy.

- [ ] **Step 1: Update `sells_daily` table definition**

In `convex/schema.ts`, replace the `sells_daily` table definition:

```ts
sells_daily: defineTable({
  date: v.string(),
  totalPythSold: v.number(),
  eventCount: v.number(),
  byTier: v.object({
    shrimp: v.number(),
    dolphin: v.number(),
    whale: v.number(),
  }),
  pythVolumeByTier: v.object({
    dolphin: v.number(),
    whale: v.number(),
  }),
})
  .index("by_date", ["date"]),
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors related to schema.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(sells): update sells_daily schema — shrimp/dolphin/whale tiers + pythVolumeByTier"
```

---

### Task 2: Update `sellsUtils.ts` and tests

**Files:**
- Modify: `convex/sellsUtils.ts`
- Modify: `convex/sellsUtils.test.ts`

**Context:** Current `Tier = "minor" | "significant" | "large" | "whale"` and `assignTier` uses thresholds: whale≥1M, large≥100K, significant≥10K. New tiers: shrimp<10K, dolphin 10K–50K (inclusive), whale>50K. Tests must be updated to match.

- [ ] **Step 1: Update the failing tests first**

Replace the `assignTier` describe block in `convex/sellsUtils.test.ts`:

```ts
describe("assignTier", () => {
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
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test convex/sellsUtils.test.ts
```

Expected: all existing `assignTier` tests fail (wrong tier names/values returned). `toUtcDateKey` and `extractSellData` tests still pass.

- [ ] **Step 3: Update `convex/sellsUtils.ts`**

Replace the `Tier` type and `assignTier` function:

```ts
export type Tier = "shrimp" | "dolphin" | "whale";

export function assignTier(pythAmount: number): Tier {
  if (pythAmount > 50_000) return "whale";
  if (pythAmount >= 10_000) return "dolphin";
  return "shrimp";
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test convex/sellsUtils.test.ts
```

Expected: all tests pass including the 3 new `assignTier` tests.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add convex/sellsUtils.ts convex/sellsUtils.test.ts
git commit -m "feat(sells): rename tiers to shrimp/dolphin/whale, update assignTier thresholds"
```

---

### Task 3: Update `sells.ts` — storeSellEvent, getSellEvents, getWhaleSellEvents; add getSellsAnalytics

**Files:**
- Modify: `convex/sells.ts`

**Context:** Four changes in this file:
1. `storeSellEvent`: remove `if (args.tier === "minor") return` guard; add `pythVolumeByTier` tracking; shrimp increments `byTier.shrimp` but NOT `totalPythSold`/`eventCount`/`pythVolumeByTier`.
2. `getSellEvents`: accept optional `tier` arg; use `by_tier_and_timestamp` index when tier is provided, otherwise filter out shrimp.
3. `getWhaleSellEvents`: add `.take(20)` limit (was `.collect()`).
4. Add new `getSellsAnalytics` query reading `sells_daily` only.

- [ ] **Step 1a: Update `MINIMUM_PYTH_AMOUNT` comment at line 13 of `convex/sells.ts`**

Replace:
```ts
const MINIMUM_PYTH_AMOUNT = 1; // store all sells; feed query filters out "minor" (< 10K) for display
```
With:
```ts
const MINIMUM_PYTH_AMOUNT = 1; // store all sells; shrimp (< 10K) filtered from display feed
```

- [ ] **Step 1b: Replace the daily aggregate block in `storeSellEvent`**

In the `storeSellEvent` handler, delete lines 99–131 (the comment `// Upsert sells_daily — only track...`, the `if (args.tier === "minor") return;` guard, and all the old daily upsert code that follows). **The `if (args.tier === "minor") return;` guard MUST be removed — it is replaced by the shrimp-aware logic below.** Replace with:

```ts
    // Upsert sells_daily — all tiers are tracked.
    // Shrimp (< 10K) increments byTier.shrimp only; excluded from totalPythSold, eventCount, pythVolumeByTier.
    const dateKey = toUtcDateKey(args.timestamp);
    const dailyRecord = await ctx.db
      .query("sells_daily")
      .withIndex("by_date", (q) => q.eq("date", dateKey))
      .first();

    const tierKey = args.tier as "shrimp" | "dolphin" | "whale";

    if (dailyRecord) {
      await ctx.db.patch(dailyRecord._id, {
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

- [ ] **Step 2: Update `getSellEvents` query**

Replace the existing `getSellEvents` query:

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

- [ ] **Step 3: Update `getWhaleSellEvents` — add `.take(20)`**

Replace `.collect()` with `.take(20)`:

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

- [ ] **Step 4: Add `getSellsAnalytics` query**

Add after `getWhaleSellEvents`:

```ts
// Sell pressure analytics — reads sells_daily only (pre-aggregated, avoids sell_events scan)
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

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type errors before deploying.

- [ ] **Step 6: Deploy Convex functions**

```bash
npx convex dev --once
```

Expected: "Convex functions ready" with no TypeScript errors.

**Note:** The `by_tier_and_timestamp` index used by the new `getSellEvents` tier-filter path already exists in `convex/schema.ts` (line 100) — no schema index change needed.

- [ ] **Step 7: Commit**

```bash
git add convex/sells.ts
git commit -m "feat(sells): update storeSellEvent/getSellEvents for new tiers, add getSellsAnalytics"
```

---

## Chunk 2: Frontend + Migration

### Task 4: Create `sells-tier-filter.tsx`

**Files:**
- Create: `components/sells/sells-tier-filter.tsx`

**Context:** Three toggle buttons — All / Dolphin / Whale. Controlled component. Active button has filled background; inactive is ghost. Shrimp not shown in feed so not included in filter.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { cn } from "@/lib/utils";

type TierFilter = "all" | "dolphin" | "whale";

interface SellsTierFilterProps {
  value: TierFilter;
  onChange: (value: TierFilter) => void;
}

const FILTERS: { value: TierFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dolphin", label: "Dolphin" },
  { value: "whale", label: "Whale" },
];

export function SellsTierFilter({ value, onChange }: SellsTierFilterProps) {
  return (
    <div className="flex gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            "rounded-xl px-4 py-1.5 text-sm font-medium transition-colors",
            value === f.value
              ? "bg-white/15 text-white"
              : "text-[#a8a1bf] hover:bg-white/8 hover:text-white"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sells/sells-tier-filter.tsx
git commit -m "feat(sells): add SellsTierFilter component — All/Dolphin/Whale toggle"
```

---

### Task 5: Create `sells-analytics.tsx`

**Files:**
- Create: `components/sells/sells-analytics.tsx`

**Context:** `"use client"` component. Local state `window: "7d" | "30d" | "all"` (default `"30d"`). Two Recharts `PieChart` components side by side: left = event counts (shrimp/dolphin/whale), right = PYTH volume (dolphin/whale only). Colors: shrimp=`#6366f1`, dolphin=`#f59e0b`, whale=`#ef4444`. Skeleton while loading, empty state if no data. Recharts is already installed.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPythAmount } from "@/lib/sells/format";

type Window = "7d" | "30d" | "all";

const COLORS = {
  shrimp: "#6366f1",
  dolphin: "#f59e0b",
  whale: "#ef4444",
};

const WINDOW_OPTIONS: { value: Window; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "7d", label: "7d" },
  { value: "all", label: "All-time" },
];

function CustomTooltip({
  active,
  payload,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { pct: string } }[];
  formatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-[#1e1830] px-3 py-2 text-xs">
      <p className="font-semibold capitalize text-white">{name}</p>
      <p className="text-[#a8a1bf]">
        {formatter(value)} ({p.pct})
      </p>
    </div>
  );
}

export function SellsAnalytics() {
  const [window, setWindow] = useState<Window>("30d");
  const data = useQuery(api.sells.getSellsAnalytics, { window });

  const isLoading = data === undefined;
  const hasData =
    data &&
    (data.eventCount.shrimp + data.eventCount.dolphin + data.eventCount.whale > 0);

  const eventData = data
    ? [
        { name: "shrimp", value: data.eventCount.shrimp, color: COLORS.shrimp },
        { name: "dolphin", value: data.eventCount.dolphin, color: COLORS.dolphin },
        { name: "whale", value: data.eventCount.whale, color: COLORS.whale },
      ].filter((d) => d.value > 0)
    : [];

  const volumeData = data
    ? [
        { name: "dolphin", value: data.pythVolume.dolphin, color: COLORS.dolphin },
        { name: "whale", value: data.pythVolume.whale, color: COLORS.whale },
      ].filter((d) => d.value > 0)
    : [];

  const totalEvents = eventData.reduce((s, d) => s + d.value, 0);
  const totalVolume = volumeData.reduce((s, d) => s + d.value, 0);

  const eventDataWithPct = eventData.map((d) => ({
    ...d,
    pct: totalEvents > 0 ? `${Math.round((d.value / totalEvents) * 100)}%` : "0%",
  }));
  const volumeDataWithPct = volumeData.map((d) => ({
    ...d,
    pct: totalVolume > 0 ? `${Math.round((d.value / totalVolume) * 100)}%` : "0%",
  }));

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
      <CardHeader className="px-7 pt-7 pb-3 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-white">
            Sell Pressure Analytics
          </CardTitle>
          <div className="flex gap-1.5">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setWindow(opt.value)}
                className={`rounded-xl px-3 py-1 text-xs font-medium transition-colors ${
                  window === opt.value
                    ? "bg-white/15 text-white"
                    : "text-[#a8a1bf] hover:bg-white/8 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-7 pb-7 sm:px-8 sm:pb-8">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col items-center gap-4">
                <div className="h-[180px] w-[180px] animate-pulse rounded-full bg-white/5" />
                <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : !hasData ? (
          <p className="py-8 text-center text-sm text-[#a8a1bf]">
            No data yet for this window.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Left: Event Count */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium text-[#8f88a9]">Sell Events</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={eventDataWithPct}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {eventDataWithPct.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <CustomTooltip formatter={(v) => `${v} events`} />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                {eventDataWithPct.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="capitalize text-[#a8a1bf]">
                      {d.name} ({d.pct})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: PYTH Volume */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-medium text-[#8f88a9]">PYTH Volume</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={volumeDataWithPct}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {volumeDataWithPct.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <CustomTooltip
                        formatter={(v) => `${formatPythAmount(v)} PYTH`}
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                {volumeDataWithPct.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="capitalize text-[#a8a1bf]">
                      {d.name} ({d.pct})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/sells/sells-analytics.tsx
git commit -m "feat(sells): add SellsAnalytics component with two Recharts pie charts"
```

---

### Task 6: Update `sell-activity-feed.tsx`

**Files:**
- Modify: `components/sells/sell-activity-feed.tsx`

**Context:** Two changes: (1) replace `TIER_STYLES` keys `large`/`significant` with `dolphin`; (2) accept `tierFilter` prop and pass to query.

**Note:** The spec says "rename section heading: 'Activity Feed' → 'Notable Sells'". The heading is NOT inside `sell-activity-feed.tsx` — it lives in `app/sells/page.tsx`. This rename is handled entirely in Task 7. No heading change is needed here. Changes in this file are: TIER_STYLES, props, query args only.

- [ ] **Step 1: Update `TIER_STYLES` — replace `large` and `significant` with `dolphin`**

Replace the `TIER_STYLES` constant:

```ts
const TIER_STYLES = {
  whale: {
    border: "border-l-red-500",
    badge: "border-red-400/30 bg-red-400/15 text-red-300",
    label: "Whale",
  },
  dolphin: {
    border: "border-l-amber-500",
    badge: "border-amber-400/30 bg-amber-400/15 text-amber-300",
    label: "Dolphin",
  },
} as const;
```

- [ ] **Step 2: Add `tierFilter` prop and update the query call**

Replace the `SellActivityFeed` function signature and query call:

```ts
export function SellActivityFeed({
  tierFilter = "all",
}: {
  tierFilter?: "all" | "dolphin" | "whale";
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.sells.getSellEvents,
    { tier: tierFilter === "all" ? undefined : tierFilter },
    { initialNumItems: 10 }
  );
```

- [ ] **Step 3: Update the tier lookup fallback**

Replace the tier lookup in `results.map`:

```ts
const tier =
  TIER_STYLES[event.tier as keyof typeof TIER_STYLES] ??
  TIER_STYLES.dolphin;
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/sells/sell-activity-feed.tsx
git commit -m "feat(sells): update SellActivityFeed — dolphin tier styles, tierFilter prop"
```

---

### Task 7: Update `app/sells/page.tsx`

**Files:**
- Modify: `app/sells/page.tsx`

**Context:** Add `tierFilter` state, import new components, restructure layout: hero → analytics → whale cards → "Notable Sells" heading + tier filter + activity feed. Update hero description text.

- [ ] **Step 1: Update the page**

Replace `app/sells/page.tsx` completely:

```tsx
"use client";

import { useState } from "react";
import { SellsSummaryBar } from "@/components/sells/sells-summary-bar";
import { WhaleCards } from "@/components/sells/whale-cards";
import { SellActivityFeed } from "@/components/sells/sell-activity-feed";
import { SellsAnalytics } from "@/components/sells/sells-analytics";
import { SellsTierFilter } from "@/components/sells/sells-tier-filter";
import { Badge } from "@/components/ui/badge";

export default function SellsPage() {
  const [tierFilter, setTierFilter] = useState<"all" | "dolphin" | "whale">("all");

  return (
    <div className="space-y-5 w-full min-w-0 overflow-x-hidden px-1 sm:px-2 lg:px-3">

      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(47,34,82,0.96)_0%,rgba(93,47,141,0.88)_54%,rgba(181,88,152,0.72)_100%)] px-6 py-7 shadow-[0_28px_70px_rgba(9,5,20,0.28)] sm:px-8">
        <div className="pointer-events-none absolute -right-8 top-2 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-28px] left-[38%] h-24 w-24 rounded-full bg-red-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                PYTH Sell Activity
              </h1>
              <div className="flex items-center gap-1.5 rounded-full border border-green-400/30 bg-green-400/15 px-2.5 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] font-semibold text-green-300">Live</span>
              </div>
            </div>
            <p className="max-w-xl text-sm text-white/80 sm:text-base">
              Tracking on-chain PYTH sell events above 10,000 PYTH
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <Badge
              variant="outline"
              className="w-fit rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/70"
            >
              Webhook-powered · No polling
            </Badge>
            <SellsSummaryBar />
          </div>
        </div>
      </section>

      {/* Sell Pressure Analytics */}
      <SellsAnalytics />

      {/* Whale Cards — hidden when no whale events exist */}
      <WhaleCards />

      {/* Notable Sells */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Notable Sells</h2>
          <SellsTierFilter value={tierFilter} onChange={setTierFilter} />
        </div>
        <SellActivityFeed tierFilter={tierFilter} />
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/sells/page.tsx
git commit -m "feat(sells): add analytics section, tier filter, rename to Notable Sells"
```

---

### Task 8: Migration + Final Checks

**Context:** The schema change is breaking — old rows with `{significant, large, whale}` byTier shape will fail Convex's validator. Both tables must be cleared from the Convex dashboard **after** deploying the new schema.

**Preflight:** Before clearing tables, confirm that the Convex deploy from Task 3 Step 6 has already completed successfully (`npx convex dev --once` showed "Convex functions ready"). If you are running Chunk 2 in isolation without having run Chunk 1, run `npx convex dev --once` now before proceeding.

- [ ] **Step 1: Clear tables from Convex dashboard**

In the Convex dashboard:
1. Go to the **Data** tab
2. Select `sell_events` table → delete all documents (use "Clear table" or select all + delete)
3. Select `sells_daily` table → delete all documents

Expected: both tables show 0 documents.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Type-check all files**

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors across all modified files.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: build succeeds with no errors. If there are TypeScript or import errors, fix them before marking complete.

- [ ] **Step 5: Commit any build fixes (if needed)**

If the build required fixes, commit them:

```bash
git add -p
git commit -m "fix(sells): resolve build errors from sells analytics update"
```

- [ ] **Step 6: Final deploy**

```bash
npx convex dev --once
```

Expected: Convex functions deploy cleanly. New webhook events will populate tables with the new tier schema.
