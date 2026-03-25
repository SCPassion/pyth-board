# `/sells` — PYTH Sell Activity Tracker: Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Phase:** 1 of 2

---

## Overview

A real-time page tracking significant on-chain PYTH sell events. Any wallet swapping PYTH into another token above 10,000 PYTH is captured via Helius webhook, stored in Convex, and displayed in a chronological activity feed. The page shows sell pressure at a glance — who is selling, how much, and when.

This is Phase 1. Phase 2 adds a repeat seller tracker. A future `/pressure` page will consume `sells_daily` alongside buyback data.

---

## Scope

### Phase 1 (this build)
- Convex schema: `sell_events` + `sells_daily` tables
- `convex/http.ts` — HTTP router (new file)
- `convex/sells.ts` — webhook handler, mutations, queries
- `app/sells/page.tsx` — the page
- Components: `SellsSummaryBar`, `WhaleCards`, `SellActivityFeed`
- Sidebar nav entry for `/sells`
- Helius webhook registration (manual step, documented in plan)

### Phase 2 (deferred)
- Repeat seller tracker (addresses with 3+ sells in 30 days)
- `/pressure` page consuming `sells_daily` + buyback data

### Explicitly out of scope
- Destination token breakdown ("what are they buying")
- Wallet labelling (known exchange/VC addresses)
- CEX deposit address tracking
- Any RPC polling or reconciliation cron — webhook-only ingestion

---

## Threshold Tiers

| Tier | Range | Display |
|---|---|---|
| Significant | 10K – 100K PYTH | Standard row |
| Large | 100K – 1M PYTH | Amber-highlighted row |
| Whale | 1M+ PYTH | Prominent card at top of page |

10,000 PYTH minimum filters out retail noise (staking/unstaking, reward claims). Anything above is a deliberate sell decision worth tracking.

---

## Data Pipeline

```
Helius webhook
  monitors: PYTH mint address, swap transactions
  → POST https://<deployment>.convex.site/webhooks/sells
  → Convex HTTP action validates authorization header + stores event
  → /sells page updates reactively via useQuery
```

### Helius Webhook Configuration
- **Watch address:** PYTH mint — `HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3`
- **Transaction type:** swap
- **Webhook URL:** `https://<deployment>.convex.site/webhooks/sells`
- **Auth:** Helius sends the API key in the `authorization` request header

### Ingestion Approach
Webhook-only (Option A). No RPC polling, no reconciliation cron. This keeps RPC usage at zero for this feature and is the right trade-off for a monitoring page where a short gap during a Helius outage is acceptable. Signature-based deduplication ensures at-least-once webhook delivery never creates duplicate records.

---

## Convex Schema

Two tables added to `convex/schema.ts`:

```ts
sell_events: defineTable({
  signature: v.string(),           // Solana tx signature — dedup key
  fromAddress: v.string(),         // selling wallet — fromUserAccount of PYTH outbound transfer
  pythAmount: v.number(),          // PYTH sold
  toToken: v.string(),             // mint address of received token (reliable from tokenTransfers)
  toTokenSymbol: v.optional(v.string()), // display symbol e.g. "USDC" — optional, may be absent
  toAmount: v.number(),            // amount of toToken received
  tier: v.string(),                // "significant" | "large" | "whale"
  timestamp: v.number(),           // unix ms
})
  .index("by_timestamp", ["timestamp"])
  .index("by_signature", ["signature"])   // required for O(1) dedup lookup
  .index("by_address", ["fromAddress"])
  .index("by_tier_and_timestamp", ["tier", "timestamp"]), // enables efficient whale range queries

sells_daily: defineTable({
  date: v.string(),           // "2026-03-25" UTC date
  totalPythSold: v.number(),
  eventCount: v.number(),
  byTier: v.object({
    // event counts (not volume) per tier for this day
    significant: v.number(),
    large: v.number(),
    whale: v.number(),
  }),
})
  .index("by_date", ["date"]),
```

`sells_daily` is upserted on every new sell event — no separate aggregation job needed. It is accurate from day one and ready for the `/pressure` page in Phase 2.

---

## Convex Functions

### `convex/http.ts` (new file)
Registers the webhook route and exports the router as the default export (required by Convex):
```ts
import { httpRouter } from "convex/server"
import { handleHeliusSellWebhook } from "./sells"

const http = httpRouter()

http.route({
  path: "/webhooks/sells",
  method: "POST",
  handler: handleHeliusSellWebhook,
})

export default http
```

### `convex/sells.ts` (new file)

**`handleHeliusSellWebhook`** — `httpAction`
- Reads the raw `authorization` header value and compares it directly to `process.env.HELIUS_API_KEY` (Helius sends the webhook secret as a plain string, not `Bearer <token>`). Rejects with 401 if it does not match.
- Iterates `payload.transactions` from Helius enhanced webhook format
- Per transaction, parses `tokenTransfers` to extract:
  - **PYTH outbound:** the entry where `mint === PYTH_MINT` — `fromUserAccount` is the seller, `tokenAmount` is the PYTH sold
  - **Token received:** the entry where `toUserAccount === sellerAddress` and `mint !== PYTH_MINT` — `mint` is stored as `toToken`, `symbol` (if present) as `toTokenSymbol`, `tokenAmount` as `toAmount`
  - `fromAddress` is derived from `fromUserAccount` on the PYTH outbound entry, not from `feePayer`
- Skips events below 10,000 PYTH
- Assigns tier: `>= 1_000_000` → whale, `>= 100_000` → large, else → significant
- Calls `storeSellEvent` for each qualifying transaction
- Returns `200 OK`

**`storeSellEvent`** — `internalMutation`
- Deduplication: queries `sell_events` using the `by_signature` index — skips insert if a record already exists for that signature
- Inserts into `sell_events`
- Upserts `sells_daily` using an explicit read-modify-write pattern (Convex has no native upsert):
  1. Query `sells_daily` by `by_date` index for today's UTC date key
  2. If record exists: `ctx.db.patch(_id, { totalPythSold: existing + pythAmount, eventCount: existing + 1, byTier: { ...existing.byTier, [tier]: existing.byTier[tier] + 1 } })`
  3. If no record: `ctx.db.insert("sells_daily", { date, totalPythSold: pythAmount, eventCount: 1, byTier: { significant: 0, large: 0, whale: 0, [tier]: 1 } })`

**`getSellEvents`** — `query`
- Uses Convex's built-in `ctx.db.query(...).order("desc").paginate(opts)` with `PaginationOptions`
- Frontend uses `usePaginatedQuery` hook (not `useQuery`) — returns `results`, `loadMore`, `status`
- Default page size: 10

**`getSellsSummary`** — `query`
- Computes date range in UTC using `Date.now()` inside the query
- Queries `sells_daily` rows whose `date` falls within the last 1, 7, and 30 days
- `last24h` aggregates only the current UTC date row. If a sell happened 23 hours ago but the UTC date rolled over, it will appear in yesterday's row — this is acceptable and expected behaviour
- Returns `{ last24h, last7d, last30d }` — each as `{ totalPythSold, eventCount }`

**`getWhaleSellEvents`** — `query`
- Uses the `by_tier_and_timestamp` compound index to efficiently query `tier = "whale"` events with a timestamp filter of `>= now - 30 days`
- Returns results ordered by `timestamp` descending

---

## Page Layout — `app/sells/page.tsx`

Data fetching via Convex `useQuery` throughout — page updates reactively when new sell events arrive. Same pattern as `ReserveBuybackSummary`.

### ① Hero Header
- Gradient banner matching the Reserve page style
- Title: "PYTH Sell Activity"
- Subtitle: "Tracking on-chain PYTH sell events above 10,000 PYTH"
- Three inline stat pills: `24h · X.XM PYTH` / `7d · X.XM PYTH` / `30d · X.XM PYTH`
- Small green "Live" badge to indicate webhook-driven updates

### ② Whale Cards (`<WhaleCards />`)
- Rendered only when `getWhaleSellEvents` returns results
- One card per whale event — amber/red gradient tint
- Shows: truncated wallet address (Solscan link), PYTH amount, time ago, "🐋 Whale" badge
- Entire section hidden if no whale events exist — no empty state

### ③ Activity Feed (`<SellActivityFeed />`)
- Chronological list, newest first, paginated (10 per page)
- Each row:
  - Coloured left border by tier (neutral / amber / red)
  - Tier badge
  - Truncated wallet address — format `Ax4f9K...mR3p` — linked to `https://solscan.io/account/<address>`
  - PYTH amount (formatted with K/M suffix)
  - Time ago (e.g. "3 mins ago", "2 hrs ago")
- Loading skeleton while data loads
- Empty state if no events have been received yet

### Summary Bar (`<SellsSummaryBar />`)
- Embedded in the hero header
- Powered by `getSellsSummary` query
- Shows skeleton loaders independently while summary loads

---

## Component Files

| File | Purpose |
|---|---|
| `components/sells/sells-summary-bar.tsx` | 24h / 7d / 30d stat pills |
| `components/sells/whale-cards.tsx` | Whale event cards |
| `components/sells/sell-activity-feed.tsx` | Paginated chronological feed |

Grouped under `components/sells/` to mirror the `components/news/` pattern already in the project.

---

## Sidebar

One new nav item added to `components/sidebar.tsx`:
```ts
{ href: "/sells", label: "Sells", icon: TrendingDown }
```
`TrendingDown` from `lucide-react` — visually distinct from the existing nav items.

---

## Webhook Validation

Helius includes the webhook secret in the `authorization` header of every webhook POST as a raw string (not `Bearer <token>` format). The HTTP action validates:
```ts
const authHeader = request.headers.get("authorization")
if (authHeader !== process.env.HELIUS_API_KEY) {
  return new Response("Unauthorized", { status: 401 })
}
```
`HELIUS_API_KEY` must be set as a Convex environment variable via `npx convex env set HELIUS_API_KEY <value>` — this is separate from Next.js `.env` files. The value stored should be the raw Helius webhook secret exactly as shown in the Helius dashboard.

---

## Transaction Parsing

Helius enhanced webhooks return a structured `tokenTransfers` array per transaction, which avoids raw Solana instruction parsing. `feePayer` is not used as the seller identity — in Jupiter swaps the fee payer may be a relayer or program-owned account. Instead, the seller is derived from the token transfer data itself.

Extraction logic:
1. Find the `tokenTransfers` entry where `mint === PYTH_MINT` — this is the PYTH outbound leg
2. `fromUserAccount` on this entry is the **selling wallet** (`fromAddress`)
3. `tokenAmount` on this entry is the **PYTH amount sold**
4. Find the `tokenTransfers` entry where `toUserAccount === fromAddress` and `mint !== PYTH_MINT` — this is the received token leg
5. `mint` on this entry is stored as `toToken` (mint address — always reliable)
6. `symbol` on this entry (if present in Helius enriched data) is stored as `toTokenSymbol` — optional, may be absent for unknown tokens
7. `tokenAmount` on this entry is `toAmount`

If no PYTH outbound entry is found for a given transaction, skip it silently. If no received token entry is found, store `toToken` as `"unknown"` and `toAmount` as `0`.

---

## Deduplication

`signature` is the natural dedup key — Solana transaction signatures are globally unique. On every `storeSellEvent` call, the mutation checks for an existing record with the same signature before inserting. Duplicate webhook deliveries are safely ignored.

---

## Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| `HELIUS_API_KEY` | Convex env vars | Validate incoming webhook requests |

---

## Git Workflow

All work on a feature branch — never directly on `main`.
Branch: `feature/sells-page`

---

## What's Deferred to Phase 2

- Repeat seller tracker — addresses with 3+ sell events in 30 days, shown as a separate table
- `/pressure` page — consumes `sells_daily` alongside buyback data for a net pressure score
- Wallet labelling — known exchange/VC/foundation address lookup
