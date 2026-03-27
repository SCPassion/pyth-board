# PYTH Activity Page — Design Spec

**Date:** 2026-03-27
**Branch:** feature/sells-page
**Status:** Approved

---

## Overview

Expand the existing `/sells` page into a combined `/activity` page that tracks both PYTH sell and buy swap events in real-time via the Helius webhook. A Buy / Sell toggle controls which mode the page displays. The buy side is a pure mirror of the sell side — same tier system, same daily aggregates, same UI components.

---

## Goals

- Give users a single page to monitor all PYTH swap pressure (buys and sells)
- Keep the buy implementation a clean mirror of the existing sell implementation
- Rename the webhook route to reflect its broader scope
- Lay the groundwork for a future "Compare" tab showing buy vs sell side by side

---

## Non-Goals

- Buy/sell comparison view (deferred to a future spec)
- Historical backfill of buy events before the new webhook route is live
- Any changes to the tier system (shrimp / dolphin / whale thresholds remain the same)

---

## Navigation & Routes

| Before | After |
|---|---|
| `/sells` | `/activity` |
| `app/sells/page.tsx` | `app/activity/page.tsx` |
| Sidebar: "Sells" + `TrendingDown` icon | Sidebar: "Activity" + `Activity` icon |
| `convex/http.ts` route `/webhooks/sells` | `/webhooks/pyth-swaps` |
| Helius webhook URL `.../webhooks/sells` | `.../webhooks/pyth-swaps` |

The `components/sells/` folder retains its name (internal, not user-facing).

**Cutover:** No dual-route period needed — the page is not yet published.

---

## Backend

### `convex/sellsUtils.ts`

Add `BuyData` type and `extractBuyData` function:

```ts
export type BuyData = {
  toAddress: string;      // wallet receiving PYTH
  pythAmount: number;     // PYTH amount received
  fromToken: string;      // token spent to buy PYTH
  fromTokenSymbol?: string;
  fromAmount: number;     // amount of fromToken spent
};

export function extractBuyData(
  tokenTransfers: TokenTransfer[],
  pythMint: string
): BuyData | null
```

Logic: find PYTH inbound transfer (`toUserAccount !== ""`, `mint === pythMint`). Return `null` if not found. The buyer address is `pythIn.toUserAccount`. Find the outbound non-PYTH leg from that address for `fromToken`/`fromAmount`.

### `convex/schema.ts`

Add two new tables:

```ts
buy_events: defineTable({
  signature: v.string(),
  fromAddress: v.string(),      // wallet that bought PYTH
  pythAmount: v.number(),
  fromToken: v.string(),        // token spent
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
  totalPythBought: v.number(),
  eventCount: v.number(),
  byTier: v.object({
    shrimp: v.number(),
    dolphin: v.number(),
    whale: v.number(),
  }),
  pythVolumeByTier: v.object({
    shrimp: v.optional(v.number()),
    dolphin: v.number(),
    whale: v.number(),
  }),
}).index("by_date", ["date"]),
```

### `convex/sells.ts` → renamed `convex/activity.ts`

New functions mirroring sell equivalents:

| New function | Mirrors |
|---|---|
| `storeBuyEvent` (internalMutation) | `storeSellEvent` |
| `getBuyEvents` (paginated query) | `getSellEvents` |
| `getBuysSummary` (query) | `getSellsSummary` |
| `getBuysAnalytics` (query) | `getSellsAnalytics` |
| `getWhaleBuyEvents` (query) | `getWhaleSellEvents` |

Webhook handler updated: for each transaction, attempt both `extractSellData` and `extractBuyData`. Store whichever returns a non-null result. A transaction cannot be both (PYTH can't be simultaneously inbound and outbound for the same user).

`getTrackingStartDate` updated to check both `sell_events` and `buy_events`, returning the earliest timestamp.

### `convex/http.ts`

```ts
http.route({
  path: "/webhooks/pyth-swaps",
  method: "POST",
  handler: handleHeliusWebhook,
});
```

---

## Frontend

### Page toggle

`app/activity/page.tsx` adds a `mode` state:

```ts
const [mode, setMode] = useState<"sell" | "buy">("sell");
```

Two pill buttons at the top of the page (same style as Reserve page tabs):
- **Sell** (default active)
- **Buy**

### Component mirroring

| New component | Mirrors |
|---|---|
| `components/sells/buy-activity-feed.tsx` | `sell-activity-feed.tsx` |
| `components/sells/buys-analytics.tsx` | `sells-analytics.tsx` |
| `components/sells/buys-summary-bar.tsx` | `sells-summary-bar.tsx` |
| `components/sells/buys-tier-filter.tsx` | `sells-tier-filter.tsx` |
| `components/sells/whale-buy-cards.tsx` | `whale-cards.tsx` |

### Page layout (mode-driven)

```
[Hero — title changes: "PYTH Sell Activity" / "PYTH Buy Activity"]
[Buy / Sell toggle]
[SellsAnalytics | BuysAnalytics]
[WhaleCards | WhaleBuyCards]
["Notable Sells" + SellsTierFilter + SellActivityFeed]
  OR
["Notable Buys" + BuysTierFilter + BuyActivityFeed]
```

The tier chips (🦐🐬🐋) and "Tracking since" badge remain in the hero regardless of mode.

---

## Testing

- `sellsUtils.test.ts`: add `extractBuyData` unit tests mirroring existing `extractSellData` tests
- Verify webhook deduplication works for buy events (same `by_signature` index pattern)
- Verify `buys_daily` aggregate increments correctly per tier

---

## Helius Webhook Update

After deploying the new route:
1. Go to Helius dashboard → edit webhook
2. Change URL from `.../webhooks/sells` to `.../webhooks/pyth-swaps`
3. Save — no other settings change (same SWAP type, same PYTH mint account filter)
