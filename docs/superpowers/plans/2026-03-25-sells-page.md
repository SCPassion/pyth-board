# PYTH Sell Activity Tracker — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/sells` page — a real-time PYTH sell event tracker powered by a Helius webhook and Convex.

**Architecture:** Helius pushes enhanced swap transactions to a Convex HTTP action which validates, parses, and stores qualifying PYTH sell events (≥10K PYTH). The `/sells` page queries Convex reactively via `useQuery`/`usePaginatedQuery` to display a summary bar, whale cards, and a chronological activity feed.

**Tech Stack:** Next.js 14 App Router, Convex (HTTP actions, internalMutation, queries), Tailwind CSS, shadcn/ui, Vitest (unit tests), Lucide React, Helius enhanced webhooks.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `convex/schema.ts` | Modify | Add `sell_events` and `sells_daily` tables |
| `convex/sellsUtils.ts` | Create | Pure parsing helpers (no Convex imports) — fully testable |
| `convex/http.ts` | Create | HTTP router + `/webhooks/sells` route + `export default` |
| `convex/sells.ts` | Create | `handleHeliusSellWebhook`, `storeSellEvent`, three queries |
| `lib/sells/format.ts` | Create | Frontend display formatters (amount, time-ago, address) |
| `lib/sells/tokenSymbols.ts` | Create | Known mint address → symbol lookup map |
| `components/sells/sells-summary-bar.tsx` | Create | 24h / 7d / 30d stat pills |
| `components/sells/whale-cards.tsx` | Create | Whale event cards (1M+ PYTH) |
| `components/sells/sell-activity-feed.tsx` | Create | Paginated chronological feed with load-more |
| `app/sells/page.tsx` | Create | Page composition |
| `components/sidebar.tsx` | Modify | Add Sells nav item with `TrendingDown` icon |

---

## Chunk 1: Convex Data Layer

### Task 1: Extend schema with sell_events and sells_daily

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the two new tables**

In `convex/schema.ts`, add these two table definitions inside `defineSchema({})`, after the `newsDigests` table and before the closing `}`:

```ts
  sell_events: defineTable({
    signature: v.string(),
    fromAddress: v.string(),
    pythAmount: v.number(),
    toToken: v.string(),
    toTokenSymbol: v.optional(v.string()),
    toAmount: v.number(),
    tier: v.string(),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_signature", ["signature"])
    .index("by_address", ["fromAddress"])
    .index("by_tier_and_timestamp", ["tier", "timestamp"]),

  sells_daily: defineTable({
    date: v.string(),
    totalPythSold: v.number(),
    eventCount: v.number(),
    byTier: v.object({
      significant: v.number(),
      large: v.number(),
      whale: v.number(),
    }),
  })
    .index("by_date", ["date"]),
```

Field notes:
- `signature` — Solana tx signature, used as dedup key via `by_signature` index
- `toToken` — always stores the mint address (reliable); `toTokenSymbol` is optional for display
- `by_tier_and_timestamp` — compound index enabling efficient whale queries with a timestamp range filter
- `sells_daily.byTier` — stores **event counts** (not PYTH volume) per tier for the day
- `sells_daily.date` — UTC date string "YYYY-MM-DD"; string comparison is lexicographically equivalent to chronological order

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors in `convex/schema.ts`.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(sells): add sell_events and sells_daily to Convex schema"
```

---

### Task 2: Create pure parsing utilities with tests

**Files:**
- Create: `convex/sellsUtils.ts`
- Create: `convex/sellsUtils.test.ts`

These are pure TypeScript functions — no Convex imports — so Vitest can test them directly. They are placed in `convex/` so `convex/sells.ts` can import them (Convex functions cannot import from `lib/`).

- [ ] **Step 1: Write the failing tests**

Create `convex/sellsUtils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assignTier, toUtcDateKey, extractSellData } from "./sellsUtils";

const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

describe("assignTier", () => {
  it("returns significant for 10K–99.9K PYTH", () => {
    expect(assignTier(10_000)).toBe("significant");
    expect(assignTier(99_999)).toBe("significant");
  });

  it("returns large for 100K–999.9K PYTH", () => {
    expect(assignTier(100_000)).toBe("large");
    expect(assignTier(999_999)).toBe("large");
  });

  it("returns whale for 1M+ PYTH", () => {
    expect(assignTier(1_000_000)).toBe("whale");
    expect(assignTier(5_000_000)).toBe("whale");
  });
});

describe("toUtcDateKey", () => {
  it("formats a UTC timestamp as YYYY-MM-DD", () => {
    // 2026-03-25T00:00:00.000Z = 1774396800000
    expect(toUtcDateKey(1774396800000)).toBe("2026-03-25");
  });

  it("uses the UTC date boundary, not local time", () => {
    // 2026-03-24T23:59:59.999Z — must resolve to Mar 24, not Mar 25
    expect(toUtcDateKey(1774396799999)).toBe("2026-03-24");
  });
});

describe("extractSellData", () => {
  const validTransfers = [
    {
      fromUserAccount: "SellerWallet111",
      toUserAccount: "JupiterProgram",
      mint: PYTH_MINT,
      tokenAmount: 50_000,
    },
    {
      fromUserAccount: "JupiterProgram",
      toUserAccount: "SellerWallet111",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      tokenAmount: 1500,
    },
  ];

  it("extracts seller address, pythAmount, toToken, toAmount from valid transfers", () => {
    const result = extractSellData(validTransfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.fromAddress).toBe("SellerWallet111");
    expect(result!.pythAmount).toBe(50_000);
    expect(result!.toToken).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result!.toAmount).toBe(1500);
  });

  it("returns null when there is no PYTH outbound transfer", () => {
    const transfers = [
      {
        fromUserAccount: "Someone",
        toUserAccount: "SellerWallet111",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1000,
      },
    ];
    expect(extractSellData(transfers, PYTH_MINT)).toBeNull();
  });

  it("maps symbol to toTokenSymbol when present on inbound transfer", () => {
    const transfers = [
      {
        fromUserAccount: "SellerWallet111",
        toUserAccount: "JupiterProgram",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
      {
        fromUserAccount: "JupiterProgram",
        toUserAccount: "SellerWallet111",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1500,
        symbol: "USDC",
      },
    ];
    const result = extractSellData(transfers, PYTH_MINT);
    expect(result!.toTokenSymbol).toBe("USDC");
  });

  it("falls back to unknown toToken and 0 toAmount when no inbound transfer is found", () => {
    const transfers = [
      {
        fromUserAccount: "SellerWallet111",
        toUserAccount: "JupiterProgram",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
    ];
    const result = extractSellData(transfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.toToken).toBe("unknown");
    expect(result!.toAmount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/sellsUtils.test.ts`
Expected: FAIL — "Cannot find module './sellsUtils'"

- [ ] **Step 3: Create convex/sellsUtils.ts**

Create `convex/sellsUtils.ts`:

```ts
export const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

export type Tier = "significant" | "large" | "whale";

export type TokenTransfer = {
  fromUserAccount: string;
  toUserAccount: string;
  mint: string;
  tokenAmount: number;
  symbol?: string; // present in some Helius enriched responses, absent for unknown tokens
};

export type SellData = {
  fromAddress: string;
  pythAmount: number;
  toToken: string;
  toTokenSymbol?: string;
  toAmount: number;
};

export function assignTier(pythAmount: number): Tier {
  if (pythAmount >= 1_000_000) return "whale";
  if (pythAmount >= 100_000) return "large";
  return "significant";
}

export function toUtcDateKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().split("T")[0];
}

/**
 * Extracts sell data from a Helius enhanced webhook tokenTransfers array.
 *
 * The seller identity is derived from the PYTH outbound transfer entry
 * (fromUserAccount), NOT from feePayer — in Jupiter swaps the fee payer
 * may be a relayer or program-owned account.
 *
 * Returns null if no PYTH outbound transfer is found (not a PYTH sell).
 * Falls back to toToken "unknown" / toAmount 0 if no inbound leg is found.
 */
export function extractSellData(
  tokenTransfers: TokenTransfer[],
  pythMint: string
): SellData | null {
  // Find PYTH outbound — PYTH leaving a user account
  const pythOut = tokenTransfers.find(
    (t) => t.mint === pythMint && t.fromUserAccount !== ""
  );
  if (!pythOut) return null;

  const sellerAddress = pythOut.fromUserAccount;

  // Find the inbound leg — any non-PYTH token arriving at the seller's account
  const tokenIn = tokenTransfers.find(
    (t) => t.toUserAccount === sellerAddress && t.mint !== pythMint
  );

  return {
    fromAddress: sellerAddress,
    pythAmount: pythOut.tokenAmount,
    toToken: tokenIn?.mint ?? "unknown",
    toTokenSymbol: tokenIn?.symbol,
    toAmount: tokenIn?.tokenAmount ?? 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/sellsUtils.test.ts`
Expected: PASS — 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add convex/sellsUtils.ts convex/sellsUtils.test.ts
git commit -m "feat(sells): add pure parsing utilities with tests"
```

---

### Task 3: Create the HTTP router

**Files:**
- Create: `convex/http.ts`

Convex requires a file named `http.ts` at the root of the `convex/` directory with a default export of an `httpRouter()` instance. This file must not be named anything else.

- [ ] **Step 1: Create convex/http.ts**

```ts
import { httpRouter } from "convex/server";
import { handleHeliusSellWebhook } from "./sells";

const http = httpRouter();

http.route({
  path: "/webhooks/sells",
  method: "POST",
  handler: handleHeliusSellWebhook,
});

export default http;
```

- [ ] **Step 2: Commit**

```bash
git add convex/http.ts
git commit -m "feat(sells): add Convex HTTP router with /webhooks/sells route"
```

Note: `sells.ts` does not exist yet — TypeScript will error if you run `tsc` now. That is expected. The file will be resolved in Task 4.

---

### Task 4: Create convex/sells.ts

**Files:**
- Create: `convex/sells.ts`

This file has four exports:
- `handleHeliusSellWebhook` — the HTTP action called by Helius
- `storeSellEvent` — internal mutation (called by the HTTP action only)
- `getSellEvents` — paginated public query
- `getSellsSummary` — public query returning 24h/7d/30d totals
- `getWhaleSellEvents` — public query returning whale events from last 30 days

- [ ] **Step 1: Create convex/sells.ts**

```ts
import { v } from "convex/values";
import { httpAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import {
  PYTH_MINT,
  assignTier,
  toUtcDateKey,
  extractSellData,
  type TokenTransfer,
} from "./sellsUtils";

const MINIMUM_PYTH_AMOUNT = 10_000;

// ─── Types ───────────────────────────────────────────────────────────────────

type HeliusTransaction = {
  signature: string;
  timestamp: number; // unix seconds — multiply by 1000 for ms
  feePayer: string;
  tokenTransfers: TokenTransfer[];
};

// ─── HTTP Action ─────────────────────────────────────────────────────────────

export const handleHeliusSellWebhook = httpAction(async (ctx, request) => {
  // Helius sends the webhook secret as a raw string in the authorization header
  // (not "Bearer <token>" format). Set HELIUS_API_KEY via: npx convex env set HELIUS_API_KEY <value>
  const authHeader = request.headers.get("authorization");
  if (authHeader !== process.env.HELIUS_API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  let transactions: HeliusTransaction[];
  try {
    transactions = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (!Array.isArray(transactions)) {
    return new Response("Bad Request", { status: 400 });
  }

  for (const tx of transactions) {
    const sellData = extractSellData(tx.tokenTransfers ?? [], PYTH_MINT);
    if (!sellData || sellData.pythAmount < MINIMUM_PYTH_AMOUNT) continue;

    const tier = assignTier(sellData.pythAmount);

    await ctx.runMutation(internal.sells.storeSellEvent, {
      signature: tx.signature,
      fromAddress: sellData.fromAddress,
      pythAmount: sellData.pythAmount,
      toToken: sellData.toToken,
      toTokenSymbol: sellData.toTokenSymbol,
      toAmount: sellData.toAmount,
      tier,
      timestamp: tx.timestamp * 1000, // Helius provides unix seconds; schema stores ms
    });
  }

  return new Response("OK", { status: 200 });
});

// ─── Internal Mutation ───────────────────────────────────────────────────────

export const storeSellEvent = internalMutation({
  args: {
    signature: v.string(),
    fromAddress: v.string(),
    pythAmount: v.number(),
    toToken: v.string(),
    toTokenSymbol: v.optional(v.string()),
    toAmount: v.number(),
    tier: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Deduplication — Helius guarantees at-least-once delivery; skip duplicates
    const existing = await ctx.db
      .query("sell_events")
      .withIndex("by_signature", (q) => q.eq("signature", args.signature))
      .first();
    if (existing) return;

    // Store the sell event
    await ctx.db.insert("sell_events", {
      signature: args.signature,
      fromAddress: args.fromAddress,
      pythAmount: args.pythAmount,
      toToken: args.toToken,
      toTokenSymbol: args.toTokenSymbol,
      toAmount: args.toAmount,
      tier: args.tier,
      timestamp: args.timestamp,
    });

    // Upsert sells_daily — date key derived from the event's own timestamp, not current time.
    // This keeps daily aggregates correct even if a webhook is delivered with a delay.
    // Convex has no native upsert — use explicit read-modify-write.
    const dateKey = toUtcDateKey(args.timestamp);
    const dailyRecord = await ctx.db
      .query("sells_daily")
      .withIndex("by_date", (q) => q.eq("date", dateKey))
      .first();

    const tierKey = args.tier as "significant" | "large" | "whale";

    if (dailyRecord) {
      await ctx.db.patch(dailyRecord._id, {
        totalPythSold: dailyRecord.totalPythSold + args.pythAmount,
        eventCount: dailyRecord.eventCount + 1,
        byTier: {
          ...dailyRecord.byTier,
          [tierKey]: dailyRecord.byTier[tierKey] + 1,
        },
      });
    } else {
      await ctx.db.insert("sells_daily", {
        date: dateKey,
        totalPythSold: args.pythAmount,
        eventCount: 1,
        byTier: {
          significant: tierKey === "significant" ? 1 : 0,
          large: tierKey === "large" ? 1 : 0,
          whale: tierKey === "whale" ? 1 : 0,
        },
      });
    }
  },
});

// ─── Queries ─────────────────────────────────────────────────────────────────

// Paginated feed — frontend uses usePaginatedQuery, not useQuery
export const getSellEvents = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sell_events")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// 24h/7d/30d aggregates from sells_daily.
// "last24h" = current UTC day only. A sell 23 hours ago that straddles midnight
// will appear in yesterday's row — this is acceptable and expected.
export const getSellsSummary = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const todayKey = toUtcDateKey(now);
    // Use 6-day lookback for 7d (today + 6 previous days = 7 days inclusive)
    const sevenDaysAgoKey = toUtcDateKey(now - 6 * 24 * 60 * 60 * 1000);
    // Use 29-day lookback for 30d (today + 29 previous days = 30 days inclusive)
    const thirtyDaysAgoKey = toUtcDateKey(now - 29 * 24 * 60 * 60 * 1000);

    // Fetch all rows in the 30-day window in one query; filter client-side for 24h/7d
    const allDays = await ctx.db
      .query("sells_daily")
      .withIndex("by_date", (q) => q.gte("date", thirtyDaysAgoKey))
      .collect();

    const sum = (days: typeof allDays) => ({
      totalPythSold: days.reduce((s, d) => s + d.totalPythSold, 0),
      eventCount: days.reduce((s, d) => s + d.eventCount, 0),
    });

    return {
      last24h: sum(allDays.filter((d) => d.date === todayKey)),
      last7d: sum(allDays.filter((d) => d.date >= sevenDaysAgoKey)),
      last30d: sum(allDays),
    };
  },
});

// Whale events from the last 30 days — uses compound index for efficient range query
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
      .collect();
  },
});
```

- [ ] **Step 2: Regenerate Convex API types**

Run: `npx convex dev --once`
Expected: Deployment succeeds. `convex/_generated/api.d.ts` is updated to include the `sells` module. No TypeScript errors. If you see errors about `internal.sells.storeSellEvent` — this resolves after the generated types are updated.

- [ ] **Step 3: Verify TypeScript is clean**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/sells.ts convex/http.ts convex/_generated/api.d.ts convex/_generated/api.js
git commit -m "feat(sells): add webhook handler, storeSellEvent mutation, and queries"
```

---

### Task 5: Set Helius API key as a Convex environment variable

- [ ] **Step 1: Set the env var**

```bash
npx convex env set HELIUS_API_KEY <your-helius-webhook-secret>
```

Replace `<your-helius-webhook-secret>` with the exact secret shown in your Helius dashboard (Settings → Webhooks → your webhook → Secret). Store the raw string — no `Bearer` prefix.

This env var lives in Convex only — it is never in a `.env` file and never committed to git.

- [ ] **Step 2: Verify it is set**

Run: `npx convex env list`
Expected: `HELIUS_API_KEY` appears in the output.

---

### Task 6: Register the Helius webhook (manual configuration step)

- [ ] **Step 1: Find your Convex webhook URL**

Run: `npx convex dashboard`
Or visit `https://dashboard.convex.dev` → your project → Settings → URL.

Your webhook URL is: `https://<your-deployment-slug>.convex.site/webhooks/sells`

The `.convex.site` URL works identically in dev and prod — point Helius at your dev deployment while building.

- [ ] **Step 2: Create the webhook in Helius**

1. Log in at [helius.dev](https://www.helius.dev)
2. Go to **Webhooks** → **New Webhook**
3. Configure:
   - **Webhook URL:** `https://<your-deployment-slug>.convex.site/webhooks/sells`
   - **Transaction Types:** `SWAP`
   - **Account Addresses:** `HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3` (PYTH mint)
   - **Webhook Type:** Enhanced Transaction (not Raw)
4. Copy the webhook secret — confirm it matches the value you set in Task 5

- [ ] **Step 3: Verify delivery with the Helius test button**

From the Helius dashboard, click **Send Test** on your new webhook.

Then check Convex logs:
```bash
npx convex logs
```
Expected: The HTTP request arrives and returns 200. If the test payload contains no qualifying PYTH transfer above 10K, nothing is stored — this is correct. The auth check is what matters here.

---

## Chunk 2: Frontend Layer

### Task 7: Create frontend formatters with tests

**Files:**
- Create: `lib/sells/format.ts`
- Create: `lib/sells/format.test.ts`
- Create: `lib/sells/tokenSymbols.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/sells/format.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatPythAmount, formatTimeAgo, truncateAddress } from "./format";

describe("formatPythAmount", () => {
  it("formats amounts under 10K with comma separators", () => {
    expect(formatPythAmount(9_999)).toBe("9,999");
  });

  it("formats 10K+ as K with one decimal when non-zero", () => {
    expect(formatPythAmount(10_000)).toBe("10K");
    expect(formatPythAmount(100_000)).toBe("100K");
    expect(formatPythAmount(123_456)).toBe("123.5K");
  });

  it("formats 1M+ as M with two decimals when non-zero", () => {
    expect(formatPythAmount(1_000_000)).toBe("1M");
    expect(formatPythAmount(5_000_000)).toBe("5M");
    expect(formatPythAmount(1_234_567)).toBe("1.23M");
  });
});

describe("truncateAddress", () => {
  it("returns first 8 and last 8 chars with ellipsis", () => {
    const addr = "Ax4f9KmR3pQZ8XwYvNbCdEfGhJkLoT1";
    expect(truncateAddress(addr)).toBe("Ax4f9KmR...GhJkLoT1");
  });

  it("returns address unchanged if 16 chars or shorter", () => {
    expect(truncateAddress("short")).toBe("short");
  });
});

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows seconds for events under 60s ago", () => {
    expect(formatTimeAgo(Date.now() - 30_000)).toBe("30s ago");
  });

  it("shows minutes for events between 60s and 60m ago", () => {
    expect(formatTimeAgo(Date.now() - 90_000)).toBe("1m ago");
  });

  it("shows hours for events between 1h and 24h ago", () => {
    expect(formatTimeAgo(Date.now() - 3_600_000)).toBe("1h ago");
  });

  it("shows days for events 24h+ ago", () => {
    expect(formatTimeAgo(Date.now() - 86_400_000)).toBe("1d ago");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/sells/format.test.ts`
Expected: FAIL — "Cannot find module './format'"

- [ ] **Step 3: Create lib/sells/format.ts**

```ts
export function formatPythAmount(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return m % 1 === 0
      ? `${m}M`
      : `${m.toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  if (amount >= 10_000) {
    const k = amount / 1_000;
    return k % 1 === 0
      ? `${k}K`
      : `${k.toFixed(1).replace(/\.?0+$/, "")}K`;
  }
  return new Intl.NumberFormat("en-US").format(Math.round(amount));
}

export function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export function formatTimeAgo(timestampMs: number): string {
  const seconds = Math.floor((Date.now() - timestampMs) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 4: Create lib/sells/tokenSymbols.ts**

Used in the activity feed to show "USDC" / "SOL" instead of raw mint addresses for common tokens. Any unknown mint falls back to a truncated address.

```ts
// Known Solana token mint address → display symbol.
// Extend this map as needed. Unknown mints fall back to truncated address.
export const TOKEN_SYMBOLS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  So11111111111111111111111111111111111111112: "SOL",
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": "WBTC",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: "JitoSOL",
  jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v: "JupSOL",
};

export function getTokenSymbol(mintAddress: string): string {
  if (mintAddress === "unknown") return "—";
  return TOKEN_SYMBOLS[mintAddress] ?? truncateMint(mintAddress);
}

function truncateMint(mint: string): string {
  if (mint.length <= 8) return mint;
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/sells/format.test.ts`
Expected: PASS — all 9 tests passing

- [ ] **Step 6: Commit**

```bash
git add lib/sells/format.ts lib/sells/format.test.ts lib/sells/tokenSymbols.ts
git commit -m "feat(sells): add frontend formatters and token symbol lookup"
```

---

### Task 8: Create SellsSummaryBar component

**Files:**
- Create: `components/sells/sells-summary-bar.tsx`

Displays three stat pills showing total PYTH sold in the last 24h, 7d, and 30d. Powered by the `getSellsSummary` Convex query. Shows skeleton loaders while data loads.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount } from "@/lib/sells/format";

export function SellsSummaryBar() {
  const summary = useQuery(api.sells.getSellsSummary, {});
  const loading = summary === undefined;

  const StatPill = ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
      <span className="text-xs text-white/60">{label}</span>
      {loading ? (
        <div className="h-4 w-16 animate-pulse rounded bg-white/15" />
      ) : (
        <span className="text-sm font-bold text-white">{value}</span>
      )}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatPill
        label="24h"
        value={`${formatPythAmount(summary?.last24h.totalPythSold ?? 0)} PYTH`}
      />
      <StatPill
        label="7d"
        value={`${formatPythAmount(summary?.last7d.totalPythSold ?? 0)} PYTH`}
      />
      <StatPill
        label="30d"
        value={`${formatPythAmount(summary?.last30d.totalPythSold ?? 0)} PYTH`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sells/sells-summary-bar.tsx
git commit -m "feat(sells): add SellsSummaryBar component"
```

---

### Task 9: Create WhaleCards component

**Files:**
- Create: `components/sells/whale-cards.tsx`

Renders a card per whale event (1M+ PYTH) from the last 30 days. Returns `null` when there are no whale events — no empty state rendered.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount, truncateAddress, formatTimeAgo } from "@/lib/sells/format";
import { ExternalLink } from "lucide-react";

export function WhaleCards() {
  const events = useQuery(api.sells.getWhaleSellEvents, {});

  // Hide section entirely when loading or empty — no skeleton, no empty state
  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white sm:text-2xl">Whale Events</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <a
            key={event._id}
            href={`https://solscan.io/tx/${event.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-[24px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(180,83,9,0.18)_0%,rgba(120,53,15,0.12)_100%)] p-5 transition-all duration-200 hover:border-amber-400/40 hover:scale-[1.01]"
          >
            <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />

            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300">
                  🐋 Whale
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

- [ ] **Step 2: Commit**

```bash
git add components/sells/whale-cards.tsx
git commit -m "feat(sells): add WhaleCards component"
```

---

### Task 10: Create SellActivityFeed component

**Files:**
- Create: `components/sells/sell-activity-feed.tsx`

Uses `usePaginatedQuery` (not `useQuery`) — this is Convex's cursor-based pagination hook. It exposes `results`, `status`, and `loadMore`. The UI uses a "Load more" button rather than numeric pages, which is the natural fit for Convex's paginator.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount, truncateAddress, formatTimeAgo } from "@/lib/sells/format";
import { getTokenSymbol } from "@/lib/sells/tokenSymbols";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_STYLES = {
  whale: {
    border: "border-l-red-500",
    badge: "border-red-400/30 bg-red-400/15 text-red-300",
    label: "Whale",
  },
  large: {
    border: "border-l-amber-500",
    badge: "border-amber-400/30 bg-amber-400/15 text-amber-300",
    label: "Large",
  },
  significant: {
    border: "border-l-white/20",
    badge: "border-white/15 bg-white/8 text-[#b4aec8]",
    label: "Significant",
  },
} as const;

export function SellActivityFeed() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.sells.getSellEvents,
    {},
    { initialNumItems: 10 }
  );

  if (status === "LoadingFirstPage") {
    return (
      <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="flex items-center justify-center gap-2 p-8 text-[#a8a1bf]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sell events...
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
          <h3 className="mb-2 text-lg font-semibold text-white">No Sell Events Yet</h3>
          <p className="mx-auto max-w-sm text-sm text-[#b4aec8]">
            Sell events above 10,000 PYTH will appear here once the webhook is active.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
      <CardHeader className="px-7 pt-7 pb-3 sm:px-8">
        <p className="text-xs text-[#a8a1bf]">
          {results.length} sell event{results.length !== 1 ? "s" : ""} — newest first
        </p>
      </CardHeader>
      <CardContent className="space-y-2 px-7 pb-7 sm:px-8 sm:pb-8">

        {/* Table header — desktop only */}
        <div className="mb-3 hidden items-center gap-4 border-b border-white/8 pb-3 px-3 md:flex">
          <div className="w-24 shrink-0">
            <p className="text-xs font-medium text-[#8f88a9]">Tier</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#8f88a9]">Wallet</p>
          </div>
          <div className="w-32 text-right">
            <p className="text-xs font-medium text-[#8f88a9]">PYTH Sold</p>
          </div>
          <div className="w-20 text-right">
            <p className="text-xs font-medium text-[#8f88a9]">Received</p>
          </div>
          <div className="w-24 text-right">
            <p className="text-xs font-medium text-[#8f88a9]">When</p>
          </div>
          <div className="w-4 shrink-0" />
        </div>

        {results.map((event) => {
          const tier =
            TIER_STYLES[event.tier as keyof typeof TIER_STYLES] ??
            TIER_STYLES.significant;

          return (
            <a
              key={event._id}
              href={`https://solscan.io/tx/${event.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-4 rounded-2xl border-l-4 border border-white/6 bg-[#2f2942] p-3 transition-all duration-200 hover:border-white/12 hover:bg-[#352d47] hover:scale-[1.005]",
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
                  <span>→ {getTokenSymbol(event.toToken)}</span>
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
                  <span className="text-xs text-[#a8a1bf]">{getTokenSymbol(event.toToken)}</span>
                </div>
                <div className="w-24 text-right">
                  <span className="text-xs text-[#a8a1bf]">{formatTimeAgo(event.timestamp)}</span>
                </div>
                <div className="w-4 shrink-0">
                  <ExternalLink className="h-4 w-4 text-[#8f88a9] transition-colors hover:text-white" />
                </div>
              </div>
            </a>
          );
        })}

        {status === "CanLoadMore" && (
          <div className="flex justify-center pt-4">
            <Button
              variant="ghost"
              className="rounded-2xl px-6 text-[#b4aec8] hover:bg-white/5 hover:text-white"
              onClick={() => loadMore(10)}
            >
              Load more
            </Button>
          </div>
        )}

        {status === "Exhausted" && results.length > 0 && (
          <p className="pt-4 text-center text-xs text-[#a8a1bf]">All sell events loaded</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sells/sell-activity-feed.tsx
git commit -m "feat(sells): add SellActivityFeed component with load-more pagination"
```

---

### Task 11: Create the /sells page and update sidebar

**Files:**
- Create: `app/sells/page.tsx`
- Modify: `components/sidebar.tsx`

- [ ] **Step 1: Create app/sells/page.tsx**

```tsx
"use client";

import { SellsSummaryBar } from "@/components/sells/sells-summary-bar";
import { WhaleCards } from "@/components/sells/whale-cards";
import { SellActivityFeed } from "@/components/sells/sell-activity-feed";
import { Badge } from "@/components/ui/badge";

export default function SellsPage() {
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

      {/* Whale Cards — hidden when no whale events exist */}
      <WhaleCards />

      {/* Activity Feed */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Activity Feed</h2>
        <SellActivityFeed />
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Update sidebar**

In `components/sidebar.tsx`:

Add `TrendingDown` to the lucide-react import:
```ts
// Before:
import {
  LayoutDashboard,
  Wallet,
  Image as ImageIcon,
  Building2,
  Newspaper,
  ArrowUpRight,
} from "lucide-react";

// After:
import {
  LayoutDashboard,
  Wallet,
  Image as ImageIcon,
  Building2,
  TrendingDown,
  Newspaper,
  ArrowUpRight,
} from "lucide-react";
```

Add the Sells nav item in the `navItems` array, between Reserve and News:
```ts
// Before:
{ href: "/reserve", label: "Reserve", icon: Building2 },
{ href: "/news", label: "News", icon: Newspaper },

// After:
{ href: "/reserve", label: "Reserve", icon: Building2 },
{ href: "/sells", label: "Sells", icon: TrendingDown },
{ href: "/news", label: "News", icon: Newspaper },
```

- [ ] **Step 3: Run the dev server and verify visually**

Run: `npm run dev:all`

Open `http://localhost:3000/sells`.

Check:
- Sidebar shows "Sells" with TrendingDown icon, highlighted when active
- Hero header renders: gradient, title, Live badge, stat pills (show 0 PYTH until events arrive)
- Activity feed shows empty state: "No Sell Events Yet"
- Whale cards section is hidden (no events)
- No console errors

- [ ] **Step 4: Commit**

```bash
git add app/sells/page.tsx components/sidebar.tsx
git commit -m "feat(sells): add /sells page and sidebar nav entry"
```

---

### Task 12: Final checks

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass. Should include `convex/sellsUtils.test.ts` and `lib/sells/format.test.ts`.

- [ ] **Step 2: Production build check**

Run: `npm run build`
Expected: Build completes with no errors. Resolve any TypeScript or ESLint errors before continuing.

- [ ] **Step 3: Confirm Convex deployment is current**

Run: `npx convex dev --once`
Expected: Deployment succeeds. Check the Convex dashboard to confirm `sell_events` and `sells_daily` tables exist in your schema.

- [ ] **Step 4: Commit any fixes**

If Step 1–3 required changes, stage only the files you touched:
```bash
git add convex/sells.ts convex/sellsUtils.ts lib/sells/format.ts components/sells/sell-activity-feed.tsx app/sells/page.tsx components/sidebar.tsx
git commit -m "fix(sells): resolve build and lint issues"
```
