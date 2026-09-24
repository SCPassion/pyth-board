# PYTH activity indexer change

This change adds a PYTH trading page at `/activity` and a separate Convex
webhook indexer. The existing staking, reserve, revenue, news, holder, and
staker jobs remain unchanged.

## What the indexer does

- Receives Helius webhook signatures at `/helius/pyth-trades`, verifies the
  shared secret, and deduplicates transaction IDs.
- Fetches finalized raw transaction evidence and optional Helius decoding,
  then parses verified PYTH endpoint buys and sells. Transactions it cannot
  classify safely remain in review and do not enter trade totals.
- Stores transaction evidence, trade rows, hourly aggregates, and operational
  health data in new Convex tables. The worker retries transient provider
  failures and supports replay of retained evidence after parser updates.
- Shows observed totals, trade history, router details, and collection status
  on the Beta-labeled Trading Activity page. The existing Growth page and ownership jobs remain unchanged.

## Scope and limits

Supported parser evidence includes Jupiter, Titan, OKX, and verified direct
pool executions described in [README.md](README.md). DFlow outer-router
executions and unverified older Jupiter routes remain in review. A PYTH leg
inside a route is not counted unless the transaction establishes a PYTH
endpoint buy or sell.

The feed counts only qualifying transactions delivered by the webhook and
parsed by the indexer. Delivery tests found missed PYTH trades, and this change
does not add backfill or reconciliation. The UI labels totals as partial
coverage. Collection is disabled by default; enabling the Helius webhook
alone does not start ingestion.

## Integration

The tracker lives in `lib/tracker/`, `convex/tracker*.ts`, and
`convex/heliusClient.ts`. Existing backend modules are untouched except for
the tracker table registration in `convex/schema.ts` and the new route in
`convex/http.ts`. The site changes are under `app/activity/` and
`components/activity/`, with navigation and README updates. `/growth` remains
the existing ownership page. No tracker cron is added.

Regression tests cover parser boundaries, router variants, retries,
deduplication, replay, and aggregate correction. Representative mainnet
fixtures retain their execution evidence; large fixtures store the normalized
parser input to keep this change reviewable.
