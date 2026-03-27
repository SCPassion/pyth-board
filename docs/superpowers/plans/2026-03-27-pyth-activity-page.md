# PYTH Activity Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `/sells` into a combined `/activity` page with a Buy/Sell toggle, mirroring all sell infrastructure for buys and renaming the webhook route to `/webhooks/pyth-swaps`.

**Architecture:** The buy side is a pure mirror of the sell side — same tier system (shrimp/dolphin/whale), same daily aggregate tables, same UI components. A `mode` state on the activity page drives which set of components renders. The Convex file `sells.ts` is renamed to `activity.ts`, shifting the API namespace from `api.sells.*` to `api.activity.*`.

**Tech Stack:** Next.js 14 App Router, Convex (schema, internalMutation, query, httpAction, usePaginatedQuery, useQuery), Helius webhooks, Vitest, Recharts, Tailwind CSS, lucide-react

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `convex/sellsUtils.ts` | Add `BuyData` type + `extractBuyData` function |
| Modify | `convex/sellsUtils.test.ts` | Add `extractBuyData` unit tests |
| Modify | `convex/schema.ts` | Add `buy_events` and `buys_daily` tables |
| Rename + Modify | `convex/sells.ts` → `convex/activity.ts` | Rename file; update internal refs; update webhook handler; add buy mutations/queries |
| Modify | `convex/http.ts` | Replace `/webhooks/sells` route with `/webhooks/pyth-swaps` |
| Modify | `components/sells/sell-activity-feed.tsx` | Update `api.sells.*` → `api.activity.*` |
| Modify | `components/sells/sells-analytics.tsx` | Update `api.sells.*` → `api.activity.*` |
| Modify | `components/sells/sells-summary-bar.tsx` | Update `api.sells.*` → `api.activity.*` |
| Modify | `components/sells/whale-cards.tsx` | Update `api.sells.*` → `api.activity.*` |
| Rename | `components/sells/sells-tier-filter.tsx` → `components/sells/tier-filter.tsx` | Shared stateless tier filter |
| Create | `components/sells/buys-analytics.tsx` | Buy analytics card (mirrors `sells-analytics.tsx`) |
| Create | `components/sells/buys-summary-bar.tsx` | Buy summary bar (mirrors `sells-summary-bar.tsx`) |
| Create | `components/sells/buy-activity-feed.tsx` | Buy activity feed (mirrors `sell-activity-feed.tsx`) |
| Create | `components/sells/whale-buy-cards.tsx` | Whale buy cards (mirrors `whale-cards.tsx`) |
| Rename + Modify | `app/sells/page.tsx` → `app/activity/page.tsx` | Activity page with Buy/Sell toggle |
| Modify | `components/sidebar.tsx` | Update nav entry href, label, icon |

---

## Chunk 1: Backend

### Task 1: Add `extractBuyData` to `sellsUtils.ts` (TDD)

**Files:**
- Modify: `convex/sellsUtils.test.ts`
- Modify: `convex/sellsUtils.ts`

- [ ] **Step 1: Add failing tests for `extractBuyData`**

Open `convex/sellsUtils.test.ts` and add after the existing `extractSellData` describe block:

```ts
describe("extractBuyData", () => {
  const validTransfers = [
    {
      fromUserAccount: "JupiterProgram",
      toUserAccount: "BuyerWallet111",
      mint: PYTH_MINT,
      tokenAmount: 50_000,
    },
    {
      fromUserAccount: "BuyerWallet111",
      toUserAccount: "JupiterProgram",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      tokenAmount: 1500,
    },
  ];

  it("extracts buyer address, pythAmount, fromToken, fromAmount from valid transfers", () => {
    const result = extractBuyData(validTransfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.toAddress).toBe("BuyerWallet111");
    expect(result!.pythAmount).toBe(50_000);
    expect(result!.fromToken).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result!.fromAmount).toBe(1500);
  });

  it("returns null when there is no PYTH inbound transfer", () => {
    const transfers = [
      {
        fromUserAccount: "BuyerWallet111",
        toUserAccount: "JupiterProgram",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1000,
      },
    ];
    expect(extractBuyData(transfers, PYTH_MINT)).toBeNull();
  });

  it("maps symbol to fromTokenSymbol when present on outbound transfer", () => {
    const transfers = [
      {
        fromUserAccount: "JupiterProgram",
        toUserAccount: "BuyerWallet111",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
      {
        fromUserAccount: "BuyerWallet111",
        toUserAccount: "JupiterProgram",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1500,
        symbol: "USDC",
      },
    ];
    const result = extractBuyData(transfers, PYTH_MINT);
    expect(result!.fromTokenSymbol).toBe("USDC");
  });

  it("falls back to unknown fromToken and 0 fromAmount when no outbound leg found", () => {
    const transfers = [
      {
        fromUserAccount: "JupiterProgram",
        toUserAccount: "BuyerWallet111",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
    ];
    const result = extractBuyData(transfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.fromToken).toBe("unknown");
    expect(result!.fromAmount).toBe(0);
  });

  it("falls back when outbound leg belongs to a different account", () => {
    const transfers = [
      {
        fromUserAccount: "JupiterProgram",
        toUserAccount: "BuyerWallet111",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
      {
        fromUserAccount: "OtherWallet",  // different account, not BuyerWallet111
        toUserAccount: "JupiterProgram",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1500,
      },
    ];
    const result = extractBuyData(transfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.fromToken).toBe("unknown");
    expect(result!.fromAmount).toBe(0);
  });
});
```

Also update the import line at the top of the file:
```ts
import { assignTier, toUtcDateKey, extractSellData, extractBuyData } from "./sellsUtils";
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: `extractBuyData` tests fail with "extractBuyData is not a function" or similar. Existing tests still pass.

- [ ] **Step 3: Add `BuyData` type and `extractBuyData` to `convex/sellsUtils.ts`**

Add after the existing `SellData` type and `extractSellData` function:

```ts
export type BuyData = {
  // toAddress = buyer's wallet (receiving PYTH).
  // Note: storeBuyEvent stores this as fromAddress in buy_events to mirror
  // sell_events.fromAddress naming convention (both mean "swap initiator").
  toAddress: string;
  pythAmount: number;
  fromToken: string;        // token spent to buy PYTH
  fromTokenSymbol?: string;
  fromAmount: number;       // amount of fromToken spent
};

/**
 * Extracts buy data from a Helius enhanced webhook tokenTransfers array.
 *
 * The buyer identity is derived from the PYTH inbound transfer entry
 * (toUserAccount). Returns null if no PYTH inbound transfer is found.
 *
 * Known limitation: uses .find() so returns the first matching PYTH-inbound
 * transfer. In aggregator/multi-hop routes, the first PYTH inbound entry may
 * be into a program-owned intermediate account rather than the end user's wallet.
 * The toUserAccount !== "" guard does not distinguish program accounts from user
 * wallets. This is an accepted limitation — same structural constraint as
 * extractSellData.
 *
 * Falls back to fromToken "unknown" / fromAmount 0 if no outbound leg is found.
 */
export function extractBuyData(
  tokenTransfers: TokenTransfer[],
  pythMint: string
): BuyData | null {
  // Find PYTH inbound — PYTH arriving at a non-empty user account
  const pythIn = tokenTransfers.find(
    (t) => t.mint === pythMint && t.toUserAccount !== ""
  );
  if (!pythIn) return null;

  const buyerAddress = pythIn.toUserAccount;
  // buyerAddress is guaranteed non-empty by the filter above,
  // so t.fromUserAccount === buyerAddress implicitly excludes program-owned accounts.

  // Find the outbound non-PYTH leg from the buyer's account
  const tokenOut = tokenTransfers.find(
    (t) => t.fromUserAccount === buyerAddress && t.mint !== pythMint
  );

  return {
    toAddress: buyerAddress,
    pythAmount: pythIn.tokenAmount,
    fromToken: tokenOut?.mint ?? "unknown",
    fromTokenSymbol: tokenOut?.symbol,
    fromAmount: tokenOut?.tokenAmount ?? 0,
  };
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
npm test
```

Expected: All tests pass including the 5 new `extractBuyData` tests.

- [ ] **Step 5: Commit**

```bash
git add convex/sellsUtils.ts convex/sellsUtils.test.ts
git commit -m "feat(activity): add extractBuyData + tests to sellsUtils"
```

---

### Task 2: Add `buy_events` and `buys_daily` to schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add tables to `convex/schema.ts`**

Add after the `sells_daily` table definition:

```ts
  buy_events: defineTable({
    // fromAddress = buyer's wallet address.
    // Named fromAddress (not toAddress) to mirror sell_events.fromAddress.
    // In both tables, fromAddress means "the user who initiated the swap."
    // BuyData.toAddress is mapped to this field in storeBuyEvent.
    fromAddress: v.string(),
    signature: v.string(),
    pythAmount: v.number(),
    fromToken: v.string(),         // token spent to buy PYTH
    fromTokenSymbol: v.optional(v.string()),
    fromAmount: v.number(),
    tier: v.string(),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_signature", ["signature"])
    .index("by_address", ["fromAddress"])
    .index("by_tier_and_timestamp", ["tier", "timestamp"]),
  buys_daily: defineTable({
    date: v.string(),
    totalPythBought: v.number(),   // excludes shrimp — same rule as sells_daily.totalPythSold
    eventCount: v.number(),        // excludes shrimp — same rule as sells_daily.eventCount
    byTier: v.object({
      // byTier DOES include shrimp — shrimp event counts are tracked here even though
      // shrimp is excluded from totalPythBought/eventCount above.
      shrimp: v.number(),
      dolphin: v.number(),
      whale: v.number(),
    }),
    // All three fields are v.number() (NOT optional). buys_daily is a brand-new table
    // with no pre-existing rows, so v.optional is not needed for backward compat.
    // Contrast: sells_daily.pythVolumeByTier.shrimp is v.optional because it was
    // added retroactively after rows without the field already existed.
    pythVolumeByTier: v.object({
      shrimp: v.number(),
      dolphin: v.number(),
      whale: v.number(),
    }),
  }).index("by_date", ["date"]),
```

- [ ] **Step 2: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(activity): add buy_events and buys_daily tables to schema"
```

---

### Task 3: Rename `sells.ts` → `activity.ts` and add buy backend functions

**Files:**
- Rename + Modify: `convex/sells.ts` → `convex/activity.ts`

This task renames the file, updates all internal references, updates the webhook handler to handle buys, and adds buy mirror functions.

- [ ] **Step 1: Copy `sells.ts` to `activity.ts`**

```bash
cp convex/sells.ts convex/activity.ts
```

- [ ] **Step 2: Update imports and types in `convex/activity.ts`**

At the top, update the import from `sellsUtils` to include `extractBuyData` and `BuyData`:

```ts
import {
  PYTH_MINT,
  assignTier,
  toUtcDateKey,
  extractSellData,
  extractBuyData,
  type TokenTransfer,
  type BuyData,
} from "./sellsUtils";
```

- [ ] **Step 3: Rename the webhook handler export in `convex/activity.ts`**

Change:
```ts
export const handleHeliusSellWebhook = httpAction(async (ctx, request) => {
```
To:
```ts
export const handleHeliusWebhook = httpAction(async (ctx, request) => {
```

- [ ] **Step 4: Update webhook handler body to prefer-sell + buy detection**

Replace the `for (const tx of transactions)` loop with:

```ts
  for (const tx of transactions) {
    const sellData = extractSellData(tx.tokenTransfers ?? [], PYTH_MINT);
    if (sellData) {
      // Sell detected — store if above minimum, skip buy detection entirely.
      // A transaction with any PYTH-outbound transfer is always a sell,
      // even if the amount is below the minimum.
      if (sellData.pythAmount >= MINIMUM_PYTH_AMOUNT) {
        await ctx.runMutation(internal.activity.storeSellEvent, {
          signature: tx.signature,
          fromAddress: sellData.fromAddress,
          pythAmount: sellData.pythAmount,
          toToken: sellData.toToken,
          toTokenSymbol: sellData.toTokenSymbol,
          toAmount: sellData.toAmount,
          tier: assignTier(sellData.pythAmount),
          timestamp: tx.timestamp * 1000,
        });
      }
      continue;
    }

    const buyData = extractBuyData(tx.tokenTransfers ?? [], PYTH_MINT);
    if (buyData && buyData.pythAmount >= MINIMUM_PYTH_AMOUNT) {
      await ctx.runMutation(internal.activity.storeBuyEvent, {
        signature: tx.signature,
        fromAddress: buyData.toAddress, // BuyData.toAddress → buy_events.fromAddress
        pythAmount: buyData.pythAmount,
        fromToken: buyData.fromToken,
        fromTokenSymbol: buyData.fromTokenSymbol,
        fromAmount: buyData.fromAmount,
        tier: assignTier(buyData.pythAmount),
        timestamp: tx.timestamp * 1000,
      });
    }
  }
```

- [ ] **Step 5: Update `internal.sells.storeSellEvent` reference in `storeSellEvent`**

Inside `storeSellEvent`, if there is any `internal.sells.*` reference (there isn't in the current code, but confirm), change to `internal.activity.*`. The existing `storeSellEvent` body doesn't call internal itself, so no change needed here — but verify.

- [ ] **Step 6: Add `storeBuyEvent` internalMutation**

Add after `storeSellEvent`:

```ts
export const storeBuyEvent = internalMutation({
  args: {
    signature: v.string(),
    fromAddress: v.string(),  // buyer's wallet (BuyData.toAddress mapped here)
    pythAmount: v.number(),
    fromToken: v.string(),
    fromTokenSymbol: v.optional(v.string()),
    fromAmount: v.number(),
    tier: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Deduplication — Helius guarantees at-least-once delivery; skip duplicates
    const existing = await ctx.db
      .query("buy_events")
      .withIndex("by_signature", (q) => q.eq("signature", args.signature))
      .first();
    if (existing) return;

    await ctx.db.insert("buy_events", {
      signature: args.signature,
      fromAddress: args.fromAddress,
      pythAmount: args.pythAmount,
      fromToken: args.fromToken,
      fromTokenSymbol: args.fromTokenSymbol,
      fromAmount: args.fromAmount,
      tier: args.tier,
      timestamp: args.timestamp,
    });

    // Upsert buys_daily — all tiers tracked including shrimp volume.
    // Shrimp excluded from totalPythBought and eventCount but tracked in byTier and pythVolumeByTier.
    const dateKey = toUtcDateKey(args.timestamp);
    const dailyRecord = await ctx.db
      .query("buys_daily")
      .withIndex("by_date", (q) => q.eq("date", dateKey))
      .first();

    const tierKey = args.tier as "shrimp" | "dolphin" | "whale";

    if (dailyRecord) {
      await ctx.db.patch(dailyRecord._id, {
        totalPythBought: tierKey !== "shrimp"
          ? dailyRecord.totalPythBought + args.pythAmount
          : dailyRecord.totalPythBought,
        eventCount: tierKey !== "shrimp"
          ? dailyRecord.eventCount + 1
          : dailyRecord.eventCount,
        byTier: {
          ...dailyRecord.byTier,
          [tierKey]: dailyRecord.byTier[tierKey] + 1,
        },
        pythVolumeByTier: {
          ...dailyRecord.pythVolumeByTier,
          [tierKey]: dailyRecord.pythVolumeByTier[tierKey] + args.pythAmount,
        },
      });
    } else {
      await ctx.db.insert("buys_daily", {
        date: dateKey,
        totalPythBought: tierKey !== "shrimp" ? args.pythAmount : 0,
        eventCount: tierKey !== "shrimp" ? 1 : 0,
        byTier: {
          shrimp: tierKey === "shrimp" ? 1 : 0,
          dolphin: tierKey === "dolphin" ? 1 : 0,
          whale: tierKey === "whale" ? 1 : 0,
        },
        pythVolumeByTier: {
          shrimp: tierKey === "shrimp" ? args.pythAmount : 0,
          dolphin: tierKey === "dolphin" ? args.pythAmount : 0,
          whale: tierKey === "whale" ? args.pythAmount : 0,
        },
      });
    }
  },
});
```

- [ ] **Step 7: Add `getBuyEvents` query**

Add after `getSellEvents`:

```ts
export const getBuyEvents = query({
  args: { paginationOpts: paginationOptsValidator, tier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tier = args.tier;
    if (tier) {
      return await ctx.db
        .query("buy_events")
        .withIndex("by_tier_and_timestamp", (q) => q.eq("tier", tier))
        .order("desc")
        .paginate(args.paginationOpts);
    }
    // "all" — exclude shrimp, same as getSellEvents
    return await ctx.db
      .query("buy_events")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("tier"), "shrimp"))
      .paginate(args.paginationOpts);
  },
});
```

- [ ] **Step 8: Add `getBuysSummary` query**

Add after `getSellsSummary`:

```ts
export const getBuysSummary = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const todayKey = toUtcDateKey(now);
    const sevenDaysAgoKey = toUtcDateKey(now - 6 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoKey = toUtcDateKey(now - 29 * 24 * 60 * 60 * 1000);

    const allDays = await ctx.db
      .query("buys_daily")
      .withIndex("by_date", (q) => q.gte("date", thirtyDaysAgoKey))
      .collect();

    const sum = (days: typeof allDays) => ({
      totalPythBought: days.reduce((s, d) => s + d.totalPythBought, 0),
      totalPythBoughtAllTiers: days.reduce(
        (s, d) =>
          s +
          d.pythVolumeByTier.shrimp +
          d.pythVolumeByTier.dolphin +
          d.pythVolumeByTier.whale,
        0
      ),
      eventCount: days.reduce((s, d) => s + d.eventCount, 0),
    });

    return {
      last24h: sum(allDays.filter((d) => d.date === todayKey)),
      last7d: sum(allDays.filter((d) => d.date >= sevenDaysAgoKey)),
      last30d: sum(allDays),
    };
  },
});
```

- [ ] **Step 9: Add `getWhaleBuyEvents` query**

Add after `getWhaleSellEvents`:

```ts
export const getWhaleBuyEvents = query({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return await ctx.db
      .query("buy_events")
      .withIndex("by_tier_and_timestamp", (q) =>
        q.eq("tier", "whale").gte("timestamp", thirtyDaysAgo)
      )
      .order("desc")
      .take(20);
  },
});
```

- [ ] **Step 10: Add `getBuysAnalytics` query**

Add after `getSellsAnalytics`:

```ts
export const getBuysAnalytics = query({
  args: { window: v.union(v.literal("7d"), v.literal("30d"), v.literal("all")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart =
      args.window === "7d"
        ? toUtcDateKey(now - 6 * 24 * 60 * 60 * 1000)
        : args.window === "30d"
        ? toUtcDateKey(now - 29 * 24 * 60 * 60 * 1000)
        : "0000-00-00";

    const days = await ctx.db
      .query("buys_daily")
      .withIndex("by_date", (q) => q.gte("date", windowStart))
      .collect();

    return {
      eventCount: {
        shrimp: days.reduce((s, d) => s + d.byTier.shrimp, 0),
        dolphin: days.reduce((s, d) => s + d.byTier.dolphin, 0),
        whale: days.reduce((s, d) => s + d.byTier.whale, 0),
      },
      pythVolume: {
        // No ?? 0 needed — pythVolumeByTier.shrimp is v.number() (non-optional) in buys_daily
        shrimp: days.reduce((s, d) => s + d.pythVolumeByTier.shrimp, 0),
        dolphin: days.reduce((s, d) => s + d.pythVolumeByTier.dolphin, 0),
        whale: days.reduce((s, d) => s + d.pythVolumeByTier.whale, 0),
      },
    };
  },
});
```

- [ ] **Step 11: Update `getTrackingStartDate` to include buy events**

Replace the existing `getTrackingStartDate`:

```ts
export const getTrackingStartDate = query({
  args: {},
  handler: async (ctx) => {
    const [firstSell, firstBuy] = await Promise.all([
      ctx.db.query("sell_events").withIndex("by_timestamp").order("asc").first(),
      ctx.db.query("buy_events").withIndex("by_timestamp").order("asc").first(),
    ]);
    const timestamps = [firstSell?.timestamp, firstBuy?.timestamp]
      .filter((t): t is number => t !== undefined);
    return timestamps.length > 0 ? Math.min(...timestamps) : null;
  },
});
```

- [ ] **Step 12: Delete the old `convex/sells.ts`**

```bash
git rm convex/sells.ts
```

- [ ] **Step 13: Commit**

```bash
git add convex/activity.ts
git commit -m "feat(activity): rename sells.ts to activity.ts, add buy backend functions"
```

---

### Task 4: Update `convex/http.ts` and deploy

**Files:**
- Modify: `convex/http.ts`

- [ ] **Step 1: Replace `convex/http.ts` content**

```ts
import { httpRouter } from "convex/server";
import { handleHeliusWebhook } from "./activity";

const http = httpRouter();

http.route({
  path: "/webhooks/pyth-swaps",
  method: "POST",
  handler: handleHeliusWebhook,
});

export default http;
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Deploy to Convex**

```bash
npx convex dev --once
```

Expected: `✔ Convex functions ready!`

- [ ] **Step 4: Commit**

```bash
git add convex/http.ts
git commit -m "feat(activity): rename webhook route to /webhooks/pyth-swaps"
```

---

## Chunk 2: Frontend

### Task 5: Update existing components to use `api.activity.*`

**Files:**
- Modify: `components/sells/sell-activity-feed.tsx`
- Modify: `components/sells/sells-analytics.tsx`
- Modify: `components/sells/sells-summary-bar.tsx`
- Modify: `components/sells/whale-cards.tsx`

- [ ] **Step 1: Update `sell-activity-feed.tsx`**

Change:
```ts
api.sells.getSellEvents
```
To:
```ts
api.activity.getSellEvents
```

- [ ] **Step 2: Update `sells-analytics.tsx`**

Change:
```ts
api.sells.getSellsAnalytics
```
To:
```ts
api.activity.getSellsAnalytics
```

- [ ] **Step 3: Update `sells-summary-bar.tsx`**

Change:
```ts
api.sells.getSellsSummary
```
To:
```ts
api.activity.getSellsSummary
```

- [ ] **Step 4: Update `whale-cards.tsx`**

Change:
```ts
api.sells.getWhaleSellEvents
```
To:
```ts
api.activity.getWhaleSellEvents
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/sells/sell-activity-feed.tsx components/sells/sells-analytics.tsx components/sells/sells-summary-bar.tsx components/sells/whale-cards.tsx
git commit -m "feat(activity): update existing sell components to api.activity namespace"
```

---

### Task 6: Extract shared `TierFilter` component and update sidebar

**Files:**
- Create: `components/sells/tier-filter.tsx`
- Delete: `components/sells/sells-tier-filter.tsx`
- Modify: `components/sidebar.tsx`

- [ ] **Step 1: Create `components/sells/tier-filter.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";

type TierFilterValue = "all" | "dolphin" | "whale";

interface TierFilterProps {
  value: TierFilterValue;
  onChange: (value: TierFilterValue) => void;
}

const FILTERS: { value: TierFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dolphin", label: "Dolphin" },
  { value: "whale", label: "Whale" },
];

export function TierFilter({ value, onChange }: TierFilterProps) {
  return (
    <div className="flex gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          aria-pressed={value === f.value}
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

- [ ] **Step 2: Delete `sells-tier-filter.tsx` and update its import in the activity page**

The import site will be updated in Task 8 when the activity page is created. For now, delete:

```bash
git rm components/sells/sells-tier-filter.tsx
```

- [ ] **Step 3: Update sidebar nav entry in `components/sidebar.tsx`**

Find the import line and add `Activity` to the lucide-react imports (remove `TrendingDown`):
```ts
import { Activity, /* other icons */ } from "lucide-react";
```

Find line 34 and update:
```ts
{ href: "/activity", label: "Activity", icon: Activity },
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors (the `sells-tier-filter` import won't be used until Task 8 replaces the sells page).

- [ ] **Step 5: Commit**

```bash
git add components/sells/tier-filter.tsx components/sidebar.tsx
git commit -m "feat(activity): extract shared TierFilter component, update sidebar nav"
```

---

### Task 7: Create buy frontend components

**Files:**
- Create: `components/sells/buys-summary-bar.tsx`
- Create: `components/sells/whale-buy-cards.tsx`
- Create: `components/sells/buy-activity-feed.tsx`
- Create: `components/sells/buys-analytics.tsx`

- [ ] **Step 1: Create `components/sells/buys-summary-bar.tsx`**

Mirror of `sells-summary-bar.tsx` using `getBuysSummary`:

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount } from "@/lib/sells/format";

export function BuysSummaryBar() {
  const summary = useQuery(api.activity.getBuysSummary, {});
  const loading = summary === undefined;

  const StatPill = ({ label, value }: { label: string; value: string }) => (
    <div className="group relative flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-4 py-2 shadow-inner transition-all duration-300 hover:border-white/20 hover:bg-black/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]">
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">{label}</span>
      {loading ? (
        <div className="h-4 w-16 animate-pulse rounded bg-white/15" />
      ) : (
        <span className="text-sm font-bold text-white drop-shadow-sm">{value}</span>
      )}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatPill
        label="24h"
        value={`${formatPythAmount(summary?.last24h.totalPythBoughtAllTiers ?? 0)} PYTH`}
      />
      <StatPill
        label="7d"
        value={`${formatPythAmount(summary?.last7d.totalPythBoughtAllTiers ?? 0)} PYTH`}
      />
      <StatPill
        label="30d"
        value={`${formatPythAmount(summary?.last30d.totalPythBoughtAllTiers ?? 0)} PYTH`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `components/sells/whale-buy-cards.tsx`**

Mirror of `whale-cards.tsx` using `getWhaleBuyEvents`:

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount, truncateAddress, formatTimeAgo } from "@/lib/sells/format";
import { ExternalLink } from "lucide-react";

export function WhaleBuyCards() {
  const events = useQuery(api.activity.getWhaleBuyEvents, {});

  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white sm:text-2xl">Whale Buy Events</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <a
            key={event._id}
            href={`https://solscan.io/tx/${event.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-[24px] border border-green-400/20 bg-[linear-gradient(135deg,rgba(22,101,52,0.18)_0%,rgba(20,83,45,0.12)_100%)] p-5 transition-all duration-200 hover:border-green-400/40 hover:scale-[1.01]"
          >
            <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-green-400/10 blur-2xl" />

            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-green-400/30 bg-green-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-green-300">
                  🐋 Whale Buy
                </span>
                <ExternalLink className="h-4 w-4 text-white/40 transition-colors group-hover:text-white/70" />
              </div>

              <p className="text-2xl font-bold text-white">
                {formatPythAmount(event.pythAmount)}{" "}
                <span className="text-base font-normal text-white/60">PYTH</span>
              </p>

              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-[#d8d3ea]">
                  {truncateAddress(event.fromAddress)}
                </span>
                <span className="text-white/50">{formatTimeAgo(event.timestamp)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/sells/buy-activity-feed.tsx`**

Mirror of `sell-activity-feed.tsx` using `getBuyEvents`. Key differences: field `fromToken` instead of `toToken`, label "buy events" instead of "sell events", "Notable Buys" header text:

```tsx
"use client";

import { useState, useEffect } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount, truncateAddress, formatTimeAgo } from "@/lib/sells/format";
import { getTokenSymbol } from "@/lib/sells/tokenSymbols";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

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

export function BuyActivityFeed({
  tierFilter = "all",
}: {
  tierFilter?: "all" | "dolphin" | "whale";
}) {
  const [page, setPage] = useState(0);
  const { results, status, loadMore } = usePaginatedQuery(
    api.activity.getBuyEvents,
    { tier: tierFilter === "all" ? undefined : tierFilter },
    { initialNumItems: PAGE_SIZE }
  );

  useEffect(() => { setPage(0); }, [tierFilter]);

  const neededForNextPage = (page + 2) * PAGE_SIZE;
  useEffect(() => {
    if (status === "CanLoadMore" && results.length < neededForNextPage) {
      loadMore(PAGE_SIZE);
    }
  }, [page, status, results.length, neededForNextPage, loadMore]);

  const pageItems = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasNextPage = results.length > (page + 1) * PAGE_SIZE || status === "CanLoadMore";
  const hasPrevPage = page > 0;
  const totalLoaded = results.length;
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalLoaded);

  if (status === "LoadingFirstPage") {
    return (
      <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="flex items-center justify-center gap-2 p-8 text-[#a8a1bf]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading buy events...
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#312940] ring-1 ring-white/8">
            <ExternalLink className="h-8 w-8 text-[#a8a1bf]" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">No Buy Events Yet</h3>
          <p className="mx-auto max-w-sm text-sm text-[#b4aec8]">
            Buy events above 10,000 PYTH will appear here once the webhook is active.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
      <CardHeader className="px-7 pt-7 pb-3 sm:px-8">
        <p className="text-xs text-[#a8a1bf]">
          Showing {start}–{end} of {status === "Exhausted" ? totalLoaded : `${totalLoaded}+`} buy events — newest first
        </p>
      </CardHeader>
      <CardContent className="space-y-2 px-7 pb-7 sm:px-8 sm:pb-8">
        <div className="mb-3 hidden items-center gap-4 border-b border-white/8 pb-3 px-3 md:flex">
          <div className="w-24 shrink-0"><p className="text-xs font-medium text-[#8f88a9]">Tier</p></div>
          <div className="flex-1 min-w-0"><p className="text-xs font-medium text-[#8f88a9]">Wallet</p></div>
          <div className="w-32 text-right"><p className="text-xs font-medium text-[#8f88a9]">PYTH Bought</p></div>
          <div className="w-20 text-right"><p className="text-xs font-medium text-[#8f88a9]">Spent</p></div>
          <div className="w-24 text-right"><p className="text-xs font-medium text-[#8f88a9]">When</p></div>
          <div className="w-4 shrink-0" />
        </div>

        {pageItems.map((event) => {
          const tier =
            TIER_STYLES[event.tier as keyof typeof TIER_STYLES] ??
            TIER_STYLES.dolphin;

          return (
            <a
              key={event._id}
              href={`https://solscan.io/tx/${event.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex items-center gap-4 rounded-2xl border-l-[3px] border border-white/5 bg-white/[0.02] p-3 transition-all duration-300 hover:-translate-y-[2px] hover:border-white/15 hover:bg-white/[0.04] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
                tier.border
              )}
            >
              {/* Mobile */}
              <div className="flex w-full flex-col gap-2 md:hidden">
                <div className="flex items-center justify-between">
                  <Badge className={cn("rounded-full border text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5", tier.badge)}>
                    {tier.label}
                  </Badge>
                  <span className="text-xs text-white/50">{formatTimeAgo(event.timestamp)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#d8d3ea]">{truncateAddress(event.fromAddress)}</span>
                  <span className="text-sm font-bold text-white">{formatPythAmount(event.pythAmount)} PYTH</span>
                </div>
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>← {event.fromTokenSymbol ?? getTokenSymbol(event.fromToken)}</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden w-full items-center gap-4 md:flex">
                <div className="w-24 shrink-0">
                  <Badge className={cn("rounded-full border text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5", tier.badge)}>
                    {tier.label}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-[#d8d3ea]">{truncateAddress(event.fromAddress)}</span>
                </div>
                <div className="w-32 text-right">
                  <span className="text-sm font-bold text-white">{formatPythAmount(event.pythAmount)}</span>
                </div>
                <div className="w-20 text-right">
                  <span className="text-xs text-[#a8a1bf]">{event.fromTokenSymbol ?? getTokenSymbol(event.fromToken)}</span>
                </div>
                <div className="w-24 text-right">
                  <span className="text-xs text-[#a8a1bf]">{formatTimeAgo(event.timestamp)}</span>
                </div>
                <div className="w-4 shrink-0 transform transition-transform duration-300 group-hover:-translate-y-[2px] group-hover:translate-x-[2px]">
                  <ExternalLink className="h-4 w-4 text-[#8f88a9] transition-colors group-hover:text-white" />
                </div>
              </div>
            </a>
          );
        })}

        <div className="flex items-center justify-between pt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasPrevPage}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl px-3 text-[#b4aec8] hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-xs text-[#a8a1bf]">Page {page + 1}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl px-3 text-[#b4aec8] hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `components/sells/buys-analytics.tsx`**

Mirror of `sells-analytics.tsx` using `getBuysAnalytics`. Key differences: `api.activity.getBuysAnalytics`, no `?? 0` for shrimp volume, label "PYTH Bought" instead of "PYTH Sold":

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPythAmount } from "@/lib/sells/format";

type TimeWindow = "7d" | "30d" | "all";

const COLORS = {
  shrimp: "#6366f1",
  dolphin: "#f59e0b",
  whale: "#ef4444",
};

const TIER_EMOJI: Record<string, string> = {
  shrimp: "🦐",
  dolphin: "🐬",
  whale: "🐋",
};

const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "7d", label: "7d" },
  { value: "all", label: "All-time" },
];

export function BuysAnalytics() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("30d");
  const data = useQuery(api.activity.getBuysAnalytics, { window: timeWindow });

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

  // No ?? 0 needed — pythVolumeByTier.shrimp is non-optional in buys_daily
  const volumeData = data
    ? [
        { name: "shrimp", value: data.pythVolume.shrimp, color: COLORS.shrimp },
        { name: "dolphin", value: data.pythVolume.dolphin, color: COLORS.dolphin },
        { name: "whale", value: data.pythVolume.whale, color: COLORS.whale },
      ].filter((d) => d.value > 0)
    : [];

  const totalEvents = eventData.reduce((s, d) => s + d.value, 0);
  const totalVolume = volumeData.reduce((s, d) => s + d.value, 0);

  const eventDataWithPct = eventData.map((d) => ({
    ...d,
    pct: totalEvents > 0 ? `${(d.value / totalEvents) * 100}%` : "0%",
    pctDisplay: totalEvents > 0 ? `${Math.round((d.value / totalEvents) * 100)}%` : "0%",
  }));
  const volumeDataWithPct = volumeData.map((d) => ({
    ...d,
    pct: totalVolume > 0 ? `${(d.value / totalVolume) * 100}%` : "0%",
    pctDisplay: totalVolume > 0 ? `${Math.round((d.value / totalVolume) * 100)}%` : "0%",
  }));

  return (
    <Card className="rounded-[32px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <CardHeader className="px-7 pt-7 pb-4 sm:px-8 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg font-bold text-white tracking-tight">
            Buy Pressure Analytics
          </CardTitle>
          <div className="flex gap-1 rounded-xl bg-black/40 p-1 ring-1 ring-white/10 backdrop-blur-md">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeWindow(opt.value)}
                aria-pressed={timeWindow === opt.value}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
                  timeWindow === opt.value
                    ? "bg-white/20 text-white shadow-[0_2px_10px_rgba(255,255,255,0.1)] ring-1 ring-white/20"
                    : "text-[#a8a1bf] hover:bg-white/10 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-7 pb-8 sm:px-8 relative z-10">
        {isLoading ? (
          <div className="flex flex-col gap-8 animate-pulse">
            <div className="space-y-4">
              <div className="h-4 w-1/3 rounded bg-white/10" />
              <div className="h-6 w-full rounded-full bg-white/5" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-white/5" />
              ))}
            </div>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-3xl ring-1 ring-white/10">📊</div>
            <p className="text-center text-base font-medium text-white/80">
              No data yet for this window.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Volume Distribution Bar */}
              <div className="flex flex-col gap-3">
                <div className="flex items-end justify-between px-1">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#a8a1bf]">Volume Distribution</h3>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-white">{formatPythAmount(totalVolume)}</span>
                      <span className="text-sm text-white/50">PYTH</span>
                    </p>
                  </div>
                </div>
                <div className="flex h-6 w-full overflow-hidden rounded-full bg-black/40 p-1 ring-1 ring-white/10 shadow-inner">
                  {volumeDataWithPct.map((d) => (
                    <div
                      key={d.name}
                      style={{ width: d.pct, backgroundColor: d.color }}
                      className="group relative h-full cursor-pointer transition-all duration-500 hover:brightness-125 first:rounded-l-full last:rounded-r-full"
                    >
                      <div className="absolute inset-x-0 -top-9 hidden justify-center group-hover:flex z-10">
                        <div className="whitespace-nowrap rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-xl ring-1 ring-white/20 backdrop-blur-md">
                          {d.pctDisplay}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-xs px-1">
                  {volumeDataWithPct.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="capitalize text-[#a8a1bf]">
                        {TIER_EMOJI[d.name]} {d.name} ({formatPythAmount(d.value)} PYTH · {d.pctDisplay})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Distribution Bar */}
              <div className="flex flex-col gap-3">
                <div className="flex items-end justify-between px-1">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#a8a1bf]">Event Distribution</h3>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-white">{totalEvents}</span>
                      <span className="text-sm text-white/50">Trades</span>
                    </p>
                  </div>
                </div>
                <div className="flex h-6 w-full overflow-hidden rounded-full bg-black/40 p-1 ring-1 ring-white/10 shadow-inner">
                  {eventDataWithPct.map((d) => (
                    <div
                      key={d.name}
                      style={{ width: d.pct, backgroundColor: d.color }}
                      className="group relative h-full cursor-pointer transition-all duration-500 hover:brightness-125 first:rounded-l-full last:rounded-r-full"
                    >
                      <div className="absolute inset-x-0 -top-9 hidden justify-center group-hover:flex z-10">
                        <div className="whitespace-nowrap rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-xl ring-1 ring-white/20 backdrop-blur-md">
                          {d.pctDisplay}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-xs px-1">
                  {eventDataWithPct.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="capitalize text-[#a8a1bf]">
                        {TIER_EMOJI[d.name]} {d.name} ({d.value} events · {d.pctDisplay})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tier Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {(["shrimp", "dolphin", "whale"] as const).map((tier) => {
                const vol = data ? data.pythVolume[tier] : 0;
                const ev = data ? data.eventCount[tier] : 0;
                const volPct = volumeDataWithPct.find((d) => d.name === tier)?.pctDisplay || "0%";
                const evPct = eventDataWithPct.find((d) => d.name === tier)?.pctDisplay || "0%";

                return (
                  <div key={tier} className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-black/20 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/20">
                    <div
                      className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
                      style={{ backgroundColor: COLORS[tier] }}
                    />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-sm ring-1 ring-white/10 shadow-inner"
                          style={{ boxShadow: `inset 0 0 15px ${COLORS[tier]}30` }}
                        >
                          {TIER_EMOJI[tier]}
                        </div>
                        <span className="text-base font-bold capitalize tracking-tight text-white">{tier}</span>
                      </div>
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[tier] }}
                      />
                    </div>
                    <div className="relative grid grid-cols-2 gap-4 rounded-xl bg-black/30 p-3 ring-1 ring-white/5">
                      <div className="flex flex-col">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a8a1bf]">Volume</p>
                        <p className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-[15px] font-bold text-white">{formatPythAmount(vol)}</span>
                          <span className="text-[10px] text-white/50">{volPct}</span>
                        </p>
                      </div>
                      <div className="flex flex-col border-l border-white/10 pl-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a8a1bf]">Events</p>
                        <p className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-[15px] font-bold text-white">{ev}</span>
                          <span className="text-[10px] text-white/50">{evPct}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/sells/buys-summary-bar.tsx components/sells/whale-buy-cards.tsx components/sells/buy-activity-feed.tsx components/sells/buys-analytics.tsx
git commit -m "feat(activity): add buy frontend components (analytics, feed, summary bar, whale cards)"
```

---

### Task 8: Create `app/activity/page.tsx` and clean up

**Files:**
- Create: `app/activity/page.tsx`
- Delete: `app/sells/page.tsx` (and `app/sells/` folder)

- [ ] **Step 1: Create `app/activity/` directory and `page.tsx`**

```bash
mkdir -p app/activity
```

Create `app/activity/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SellsAnalytics } from "@/components/sells/sells-analytics";
import { BuysAnalytics } from "@/components/sells/buys-analytics";
import { WhaleCards } from "@/components/sells/whale-cards";
import { WhaleBuyCards } from "@/components/sells/whale-buy-cards";
import { SellActivityFeed } from "@/components/sells/sell-activity-feed";
import { BuyActivityFeed } from "@/components/sells/buy-activity-feed";
import { SellsSummaryBar } from "@/components/sells/sells-summary-bar";
import { BuysSummaryBar } from "@/components/sells/buys-summary-bar";
import { TierFilter } from "@/components/sells/tier-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Mode = "sell" | "buy";

export default function ActivityPage() {
  const [mode, setMode] = useState<Mode>("sell");
  const [tierFilter, setTierFilter] = useState<"all" | "dolphin" | "whale">("all");

  const trackingStart = useQuery(api.activity.getTrackingStartDate, {});
  const trackingSince = trackingStart
    ? new Date(trackingStart).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const isSell = mode === "sell";

  return (
    <div className="space-y-5 w-full min-w-0 overflow-x-hidden px-1 sm:px-2 lg:px-3">

      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-[32px] border border-white/15 bg-[linear-gradient(135deg,rgba(40,28,70,0.96)_0%,rgba(70,35,110,0.88)_50%,rgba(140,50,110,0.8)_100%)] px-6 py-8 shadow-[0_20px_60px_rgba(9,5,20,0.4)] sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-500/20 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-32 left-[20%] h-64 w-64 rounded-full bg-pink-500/20 blur-[80px]" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between min-w-0">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-4xl">
                {isSell ? "PYTH Sell Activity" : "PYTH Buy Activity"}
              </h1>
              <Badge className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_20px_rgba(73,224,255,0.4)] backdrop-blur-md">
                BETA
              </Badge>
            </div>
            <p className="max-w-xl text-sm text-white/80 sm:text-base">
              Tracking all on-chain PYTH {isSell ? "sell" : "buy"} events in real-time
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                🦐 <span className="font-medium text-white/90">Shrimp</span> &lt; 10K PYTH
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                🐬 <span className="font-medium text-white/90">Dolphin</span> 10K – 50K PYTH
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                🐋 <span className="font-medium text-white/90">Whale</span> &gt; 50K PYTH
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Badge
                variant="outline"
                className="w-fit rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/70"
              >
                Webhook-powered · No polling
              </Badge>
              {trackingSince && (
                <Badge
                  variant="outline"
                  className="w-fit rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/70"
                >
                  Tracking since {trackingSince}
                </Badge>
              )}
            </div>
            {isSell ? <SellsSummaryBar /> : <BuysSummaryBar />}
          </div>
        </div>
      </section>

      {/* Buy / Sell Toggle */}
      <div className="flex items-center justify-center gap-2 rounded-[24px] border border-white/8 bg-[#312940] p-2">
        <Button
          size="sm"
          variant={isSell ? "default" : "ghost"}
          className={
            isSell
              ? "h-10 rounded-2xl bg-[#6f4bd8] px-6 text-white hover:bg-[#7b57e3]"
              : "h-10 rounded-2xl px-6 text-[#b4aec8] hover:bg-white/5 hover:text-white"
          }
          onClick={() => { setMode("sell"); setTierFilter("all"); }}
        >
          Sell
        </Button>
        <Button
          size="sm"
          variant={!isSell ? "default" : "ghost"}
          className={
            !isSell
              ? "h-10 rounded-2xl bg-[#6f4bd8] px-6 text-white hover:bg-[#7b57e3]"
              : "h-10 rounded-2xl px-6 text-[#b4aec8] hover:bg-white/5 hover:text-white"
          }
          onClick={() => { setMode("buy"); setTierFilter("all"); }}
        >
          Buy
        </Button>
      </div>

      {/* Analytics */}
      {isSell ? <SellsAnalytics /> : <BuysAnalytics />}

      {/* Whale Cards */}
      {isSell ? <WhaleCards /> : <WhaleBuyCards />}

      {/* Notable Events */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            {isSell ? "Notable Sells" : "Notable Buys"}
          </h2>
          <TierFilter value={tierFilter} onChange={setTierFilter} />
        </div>
        {isSell
          ? <SellActivityFeed tierFilter={tierFilter} />
          : <BuyActivityFeed tierFilter={tierFilter} />
        }
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Delete old sells page**

```bash
git rm app/sells/page.tsx
rmdir app/sells 2>/dev/null || true
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/activity/page.tsx
git commit -m "feat(activity): create activity page with Buy/Sell toggle, remove sells page"
```

---

## Post-Implementation: Helius Webhook Update

After all tasks are complete and deployed:

1. Go to [dev.helius.xyz](https://dev.helius.xyz) → Webhooks → click edit on `8084855a-4e70-4fd5-9493-a47761b65ce1`
2. Change URL from `https://utmost-newt-607.convex.site/webhooks/sells` to `https://utmost-newt-607.convex.site/webhooks/pyth-swaps`
3. Save — no other settings change (SWAP type and PYTH mint account filter stay the same)
