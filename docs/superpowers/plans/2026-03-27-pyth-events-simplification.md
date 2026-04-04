# PYTH Events Simplification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify PYTH webhook ingestion to classify buy/sell events only from net wallet PYTH balance changes and store a minimal event record in Convex.

**Architecture:** Replace route-aware parsing with a single net-delta classifier driven by Helius owner-level token balance changes. Collapse the raw storage model to one `pyth_events` table and derive buy/sell views and summaries from that source of truth.

**Tech Stack:** Convex HTTP actions, Convex schema/query/mutation APIs, Helius enhanced webhooks, Vitest, Next.js App Router

---

## Chunk 1: Backend Model

### Task 1: Replace raw storage schema with one minimal event table

**Files:**
- Modify: `convex/schema.ts`

- [ ] Define `pyth_events` with only `signature`, `walletAddress`, `direction`, `pythAmount`, `timestamp`
- [ ] Add indexes for signature+wallet, direction+timestamp, and timestamp
- [ ] Remove `buy_events`, `sell_events`, `buys_daily`, and `sells_daily`

### Task 2: Add failing tests for net-PYTH classification

**Files:**
- Modify: `convex/sellsUtils.test.ts`
- Modify: `convex/sellsUtils.ts`

- [ ] Add tests for positive net PYTH delta => buy
- [ ] Add tests for negative net PYTH delta => sell
- [ ] Add tests for multiple account changes collapsing to one wallet delta
- [ ] Add tests for zero net PYTH delta => ignored

### Task 3: Implement minimal net-delta extractor

**Files:**
- Modify: `convex/sellsUtils.ts`

- [ ] Remove route-dependent token metadata extraction
- [ ] Implement net PYTH delta per wallet from account balance changes
- [ ] Return only wallet address, direction, absolute PYTH amount

## Chunk 2: Webhook + Queries

### Task 4: Rewrite webhook ingestion around minimal events

**Files:**
- Modify: `convex/activity.ts`

- [ ] Replace buy/sell branching logic with one `extractPythEvents` pass
- [ ] Deduplicate by `(signature, walletAddress)`
- [ ] Store only minimal event fields in `pyth_events`

### Task 5: Rebuild page queries from `pyth_events`

**Files:**
- Modify: `convex/activity.ts`

- [ ] Re-implement buy/sell feed queries as direction-filtered reads from `pyth_events`
- [ ] Re-implement summary/analytics queries using `pyth_events`
- [ ] Keep public query shapes compatible where reasonable to minimize UI churn

## Chunk 3: Verification

### Task 6: Verify backend behavior

**Files:**
- Modify: `convex/sellsUtils.test.ts`

- [ ] Run `npx vitest run convex/sellsUtils.test.ts`
- [ ] Run `npx tsc --noEmit --skipLibCheck --target ES2022 --module commonjs convex/activity.ts convex/sellsUtils.ts`

Plan complete and saved to `docs/superpowers/plans/2026-03-27-pyth-events-simplification.md`.
