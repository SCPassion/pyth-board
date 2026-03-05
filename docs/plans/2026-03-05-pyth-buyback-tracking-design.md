# PYTH Buyback Tracking Design

Date: 2026-03-05
Status: Approved
Scope: Reserve page buyback analytics for Pythian Council Ops

## 1. Problem Statement
The reserve page currently shows holdings and recent swap activity, but it does not provide a durable long-term view of buyback execution quality.

Goal: track, over time, how much USDC the DAO has spent buying PYTH and at what average executed price.

## 2. Decisions Confirmed
- Cost basis method: simple weighted average.
  - `avg_buy_price_usd = total_usdc_spent / total_pyth_bought`
- Coverage: all Pythian Council Ops swaps where input is USDC and output includes PYTH.
  - Includes DCA and non-DCA/manual routed swaps.
- Address scope: Pythian Council Ops only.
- History strategy: start now (no backfill in phase 1).
- Snapshot cadence: hourly.
- UI scope: add buyback KPIs and trend chart to reserve page.

## 3. Recommended Approach
Use Convex snapshot persistence (hourly) as the system of record for buyback analytics.

Rationale:
- Supports true over-time tracking with durable points.
- Avoids heavy recomputation for every page load.
- Fits existing Convex snapshot + cron architecture already used for reserve holdings.

## 4. Architecture
### 4.1 Data Tables
Add a new table for buyback snapshots.

`pythBuybackSnapshots`
- `timestampMs: number`
- `minuteBucketMs: number`
- `totalUsdcSpent: number`
- `totalPythBought: number`
- `avgBuyPriceUsd: number`
- `latestProcessedSignature: string` (optional when storing state separately)
- indexes:
  - `by_minuteBucketMs`
  - `by_timestampMs`

State handling (choose one):
1. Add a separate singleton state table (`pythBuybackState`) with `latestProcessedSignature`, running totals.
2. Reuse latest snapshot row as state source.

Recommended: separate state table for clearer idempotency and recovery semantics.

### 4.2 Job Flow
Add internal action `runPythBuybackSnapshotJob`:
1. Read state (`latestProcessedSignature`, cumulative totals).
2. Fetch newer Council Ops signatures after the cursor.
3. Parse transactions and filter only USDC->PYTH buys.
4. Sum deltas from newly discovered qualifying signatures:
  - `deltaUsdcSpent`
  - `deltaPythBought`
5. Update cumulative totals:
  - `totalUsdcSpent += deltaUsdcSpent`
  - `totalPythBought += deltaPythBought`
6. Compute average:
  - if `totalPythBought > 0`, `avg = totalUsdcSpent / totalPythBought`, else `0`.
7. Persist snapshot + cursor/state atomically (within mutation boundaries).

### 4.3 Scheduling
Update Convex crons to run buyback snapshot hourly:
- `fetch pyth buyback metrics hourly`
- interval: `{ hours: 1 }`

### 4.4 Query Layer
Add query endpoint for reserve page:
- latest metrics:
  - `totalUsdcSpent`
  - `totalPythBought`
  - `avgBuyPriceUsd`
  - `updatedAt`
- chart series:
  - `[ { timestampMs, avgBuyPriceUsd, totalUsdcSpent, totalPythBought } ]`

## 5. Parsing and Inclusion Rules
Count a transaction only when all are true:
- Owner address: Pythian Council Ops multisig.
- Input token: exact USDC mint.
- Output delta: positive amount for exact PYTH mint.
- Signature not already processed.

Exclude:
- Non-USDC swaps into PYTH.
- Transfers/staking ops without swap semantics.
- Duplicate signatures.

## 6. Reserve Page Changes
Integrate on `/reserve`.

### 6.1 New KPI block
- Total USDC Spent (cumulative)
- Total PYTH Bought (cumulative)
- Average Buy Price (USD/PYTH)
- Last updated timestamp

### 6.2 New chart
- Title: `PYTH Buyback Average Price Over Time`
- X-axis: snapshot timestamp
- Y-axis: average buy price (USD)
- Tooltip: timestamp, avg price, cumulative spent/bought at that point

### 6.3 Interaction
- Refresh action should refetch buyback data alongside reserve summary/swap list.
- On partial failure, keep existing reserve data visible and show a scoped buyback error state.

## 7. Error Handling and Reliability
- If RPC fetch/parse fails: keep previous totals unchanged and retain last good snapshot.
- If no new qualifying transactions: optionally write a flat snapshot for continuity.
- Division-by-zero guard when no PYTH bought yet.
- Maintain idempotency with signature cursor/dedup logic.

## 8. Testing Strategy
### 8.1 Unit tests
- USDC->PYTH filtering logic.
- Delta extraction from parsed token balances.
- Weighted-average math and zero guards.
- Dedup logic by signature.

### 8.2 Integration tests
- Job idempotency: rerunning with same signature set does not change totals.
- Cursor progression with mixed qualifying/non-qualifying txs.
- Snapshot output shape consumed by reserve page.

### 8.3 UI tests
- Reserve page renders KPI values from query payload.
- Chart renders ordered hourly points.
- Error fallback displays buyback section failure without breaking page.

## 9. Operational Notes
- Hourly cadence gives sufficient trend visibility while keeping compute/write load low.
- Convex write volume expected to remain small (~24 snapshots/day).
- RPC workload is bounded by incremental cursor processing, not full historical rescans.

## 10. Future Extensions (Out of Scope for Phase 1)
- Historical backfill before tracking start date.
- Include additional buy routes/assets if governance scope changes.
- Add unrealized PnL metric using live PYTH price against average buy price.
