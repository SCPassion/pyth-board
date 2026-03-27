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
| `app/sells/` folder | `app/activity/` folder |
| `components/sidebar.tsx` line 34: `href: "/sells"`, label `"Sells"`, icon `TrendingDown` (lucide-react, verified) | `href: "/activity"`, label `"Activity"`, icon `Activity` (lucide-react) |
| `convex/sells.ts` | `convex/activity.ts` |
| `convex/http.ts` route `/webhooks/sells` | `/webhooks/pyth-swaps` (old route removed — see below) |
| Helius webhook URL `.../webhooks/sells` | `.../webhooks/pyth-swaps` |

The `components/sells/` folder retains its name (internal, not user-facing).

**No redirect from `/sells` to `/activity`:** The page is not yet published so no external links exist.

**Convex API namespace change:** Renaming `convex/sells.ts` → `convex/activity.ts` changes the generated namespace from `api.sells.*` to `api.activity.*` (public) and `internal.sells.*` to `internal.activity.*` (internal). All call sites must be updated:

| File | Old call | New call |
|---|---|---|
| `app/activity/page.tsx` | `api.sells.getTrackingStartDate` | `api.activity.getTrackingStartDate` |
| `components/sells/sell-activity-feed.tsx` | `api.sells.getSellEvents` | `api.activity.getSellEvents` |
| `components/sells/sells-analytics.tsx` | `api.sells.getSellsAnalytics` | `api.activity.getSellsAnalytics` |
| `components/sells/sells-summary-bar.tsx` | `api.sells.getSellsSummary` | `api.activity.getSellsSummary` |
| `components/sells/whale-cards.tsx` | `api.sells.getWhaleSellEvents` | `api.activity.getWhaleSellEvents` |
| Inside `convex/activity.ts` webhook handler | `internal.sells.storeSellEvent` | `internal.activity.storeSellEvent` |
| Inside `convex/activity.ts` webhook handler | _(new)_ | `internal.activity.storeBuyEvent` (new call, no old equivalent) |

`convex/http.ts` must be fully replaced — remove the old route, add the new one, update the import:
```ts
// convex/http.ts — final state
import { handleHeliusWebhook } from "./activity";  // was: handleHeliusSellWebhook from "./sells"

const http = httpRouter();

http.route({
  path: "/webhooks/pyth-swaps",   // replaces /webhooks/sells — old route removed
  method: "POST",
  handler: handleHeliusWebhook,
});

export default http;
```

The handler export in `convex/activity.ts` is renamed from `handleHeliusSellWebhook` to `handleHeliusWebhook`.

**Cutover:** No dual-route period needed — the page is not yet published.

---

## Backend

### `convex/sellsUtils.ts`

Add `BuyData` type and `extractBuyData` function:

```ts
export type BuyData = {
  // toAddress = buyer's wallet (receiving PYTH).
  // Note: storeBuyEvent stores this as fromAddress in buy_events to mirror
  // sell_events.fromAddress naming convention (both mean "swap initiator").
  toAddress: string;
  pythAmount: number;
  fromToken: string;        // token spent to buy PYTH
  fromTokenSymbol?: string;
  fromAmount: number;
};

/**
 * Extracts buy data from a Helius enhanced webhook tokenTransfers array.
 *
 * The buyer identity is derived from the PYTH inbound transfer entry
 * (toUserAccount). Returns null if no PYTH inbound transfer is found.
 *
 * Known limitation: uses .find() so returns the first matching PYTH-inbound
 * transfer. In aggregator/multi-hop routes, the first PYTH inbound entry may
 * be into a program-owned intermediate account (e.g. a pool vault) rather than
 * the end user's wallet. The toUserAccount !== "" guard does not distinguish
 * program accounts from user wallets. If this happens, the outbound-leg lookup
 * will fail and fromToken/"fromAmount" will fall back to "unknown"/0, and
 * fromAddress will store the intermediate account. This is an accepted
 * limitation — the same structural constraint as extractSellData's .find() caveat.
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

**Note on buy+sell in same transaction:** In rare multi-hop aggregator routes, both `extractSellData` and `extractBuyData` could return non-null for different accounts. The webhook handler resolves this by **preferring sell**: if `extractSellData` returns non-null (regardless of amount), the transaction is treated as a sell and buy detection is skipped entirely. This is intentional — the sell signal is the primary user action.

### `convex/schema.ts`

Add two new tables:

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

### `convex/activity.ts` (renamed from `convex/sells.ts`)

Existing sell functions retained unchanged (only `internal.sells.*` self-references updated to `internal.activity.*`). New buy functions added as mirrors:

| New function | Mirrors | Notes |
|---|---|---|
| `storeBuyEvent` (internalMutation) | `storeSellEvent` | see details below |
| `getBuyEvents` (paginated query) | `getSellEvents` | must replicate shrimp-exclusion: when `tier` is `undefined` ("all"), apply `.filter((q) => q.neq(q.field("tier"), "shrimp"))` — same as `getSellEvents` |
| `getBuysSummary` (query) | `getSellsSummary` | |
| `getBuysAnalytics` (query) | `getSellsAnalytics` | do NOT use `?? 0` for shrimp — field is non-optional in `buys_daily` |
| `getWhaleBuyEvents` (query) | `getWhaleSellEvents` | |

**`storeBuyEvent`** behaviour:
- Maps `buyData.toAddress` → stored as `fromAddress` in `buy_events`
- Applies `MINIMUM_PYTH_AMOUNT = 1` guard
- Deduplicates by `signature` via `by_signature` index
- Shrimp events: increment `byTier.shrimp` and `pythVolumeByTier.shrimp`, but do NOT increment `totalPythBought` or `eventCount` (same shrimp-exclusion rule as `storeSellEvent`)
- On insert, all three `pythVolumeByTier` fields are always written as concrete numbers (`0` if that tier did not apply), never `undefined`

**`getBuysAnalytics`** implementation note: unlike `getSellsAnalytics`, do NOT use `?? 0` null-coalescing for `pythVolumeByTier.shrimp`. The field is `v.number()` (non-optional) in `buys_daily`, so `d.pythVolumeByTier.shrimp` is always a number and the guard is unnecessary.

**Webhook handler** (`handleHeliusWebhook`) — for each transaction, the prefer-sell rule is:
```ts
const sellData = extractSellData(tx.tokenTransfers ?? [], PYTH_MINT);
if (sellData) {
  // Sell detected — store if above minimum, skip buy detection entirely
  if (sellData.pythAmount >= MINIMUM_PYTH_AMOUNT) {
    await ctx.runMutation(internal.activity.storeSellEvent, { ... });
  }
  continue;
}
const buyData = extractBuyData(tx.tokenTransfers ?? [], PYTH_MINT);
if (buyData && buyData.pythAmount >= MINIMUM_PYTH_AMOUNT) {
  await ctx.runMutation(internal.activity.storeBuyEvent, { ... });
}
```

This ensures a transaction with a PYTH-outbound transfer is always classified as a sell, even if the amount is below the minimum. It is never reclassified as a buy.

**`getTrackingStartDate`** updated to return the earliest timestamp across both tables:
```ts
const [firstSell, firstBuy] = await Promise.all([
  ctx.db.query("sell_events").withIndex("by_timestamp").order("asc").first(),
  ctx.db.query("buy_events").withIndex("by_timestamp").order("asc").first(),
]);
const timestamps = [firstSell?.timestamp, firstBuy?.timestamp]
  .filter((t): t is number => t !== undefined);
return timestamps.length > 0 ? Math.min(...timestamps) : null;
```

---

## Frontend

### Page toggle

`app/activity/page.tsx` adds a `mode` state:

```ts
const [mode, setMode] = useState<"sell" | "buy">("sell");
```

Two pill buttons below the hero (same style as Reserve page's Overview / PYTH History tabs):
- **Sell** (default active)
- **Buy**

### Component mirroring

`sells-tier-filter.tsx` is a pure stateless UI component (no Convex calls, props: `value: "all" | "dolphin" | "whale"`, `onChange`). It is extracted into a shared `TierFilter` component reused by both sides. The original `sells-tier-filter.tsx` is deleted and its import sites updated. Known import site: `app/activity/page.tsx` (previously `app/sells/page.tsx` line 8).

| Action | File | Notes |
|---|---|---|
| Extract + delete | `components/sells/sells-tier-filter.tsx` → `components/sells/tier-filter.tsx` | Update all import sites |
| New | `components/sells/buys-analytics.tsx` | mirrors `sells-analytics.tsx`; calls `api.activity.getBuysAnalytics`; no `?? 0` for shrimp |
| New | `components/sells/buys-summary-bar.tsx` | mirrors `sells-summary-bar.tsx`; calls `api.activity.getBuysSummary` |
| New | `components/sells/buy-activity-feed.tsx` | mirrors `sell-activity-feed.tsx`; calls `api.activity.getBuyEvents` |
| New | `components/sells/whale-buy-cards.tsx` | mirrors `whale-cards.tsx`; calls `api.activity.getWhaleBuyEvents` |

### Page layout (mode-driven)

```
[Hero — title: "PYTH Sell Activity" (sell) / "PYTH Buy Activity" (buy)]
[Tier chips 🦐🐬🐋 + "Tracking since" badge — always visible]
[Sell / Buy toggle]
[SellsAnalytics        |  BuysAnalytics       ]
[WhaleCards            |  WhaleBuyCards        ]
["Notable Sells"       |  "Notable Buys"       ]
[TierFilter (shared)   |  TierFilter (shared)  ]
[SellActivityFeed      |  BuyActivityFeed      ]
```

---

## Testing

`sellsUtils.test.ts` — add `extractBuyData` unit tests:
- Returns `null` when no PYTH inbound transfer exists
- Correctly identifies buyer address and `pythAmount`
- Falls back to `fromToken: "unknown"` / `fromAmount: 0` when outbound leg belongs to a different account
- Falls back to `fromToken: "unknown"` / `fromAmount: 0` when no outbound non-PYTH leg exists at all
- Shrimp / dolphin / whale boundary amounts assigned correctly via `assignTier`

Other:
- Verify `storeBuyEvent` deduplication (same `by_signature` index pattern as sells)
- Verify `buys_daily` aggregate increments correctly per tier including shrimp volume
- Verify shrimp excluded from `totalPythBought` and `eventCount` in `buys_daily`

---

## Helius Webhook Update

After deploying the new route:
1. Go to Helius dashboard → edit webhook
2. Change URL from `.../webhooks/sells` to `.../webhooks/pyth-swaps`
3. Save — no other settings change (same SWAP type, same PYTH mint account filter)
