import { v } from "convex/values";
import { httpAction, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import {
  PYTH_MINT,
  assignTier,
  toUtcDateKey,
  extractSellData,
  type TokenTransfer,
} from "./sellsUtils";

const MINIMUM_PYTH_AMOUNT = 1; // store all sells; shrimp (< 10K) filtered from display feed

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
  },
});

// ─── Queries ─────────────────────────────────────────────────────────────────

// Paginated feed — frontend uses usePaginatedQuery, not useQuery
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
      .take(20);
  },
});

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
