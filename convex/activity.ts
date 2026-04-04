import { v } from "convex/values";
import { httpAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import {
  PYTH_MINT,
  assignTier,
  extractPythEvents,
  type AccountData,
  type TokenTransfer,
} from "./sellsUtils";

type Direction = "buy" | "sell";

type HeliusTransaction = {
  signature: string;
  timestamp: number;
  type?: string;
  source?: string;
  feePayer?: string;
  accountData?: AccountData[];
  tokenTransfers?: TokenTransfer[];
};

type StoredPythEvent = {
  _id: unknown;
  signature: string;
  walletAddress: string;
  direction: Direction;
  pythAmount: number;
  timestamp: number;
};

function toFeedEvent(event: {
  _id: unknown;
  signature: string;
  walletAddress: string;
  pythAmount: number;
  timestamp: number;
}) {
  return {
    _id: event._id,
    signature: event.signature,
    fromAddress: event.walletAddress,
    pythAmount: event.pythAmount,
    tier: assignTier(event.pythAmount),
    timestamp: event.timestamp,
  };
}

function summarize(events: Array<{ pythAmount: number }>) {
  const notable = events.filter((event) => assignTier(event.pythAmount) !== "shrimp");
  return {
    total: notable.reduce((sum, event) => sum + event.pythAmount, 0),
    totalAllTiers: events.reduce((sum, event) => sum + event.pythAmount, 0),
    eventCount: notable.length,
  };
}

function analytics(events: Array<{ pythAmount: number }>) {
  const base = {
    eventCount: { shrimp: 0, dolphin: 0, whale: 0 },
    pythVolume: { shrimp: 0, dolphin: 0, whale: 0 },
  };

  for (const event of events) {
    const tier = assignTier(event.pythAmount);
    base.eventCount[tier] += 1;
    base.pythVolume[tier] += event.pythAmount;
  }

  return base;
}

async function collectDirectionEvents(ctx: any, direction: Direction): Promise<StoredPythEvent[]> {
  return await ctx.db
    .query("pyth_events")
    .withIndex("by_direction_and_timestamp", (q: any) => q.eq("direction", direction))
    .order("desc")
    .collect();
}

export const handleHeliusWebhook = httpAction(async (ctx, request) => {
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
    const isTrackedSwap = tx.type === "SWAP";

    if (!isTrackedSwap) {
      console.log(
        `[pyth-webhook] skipped sig=${tx.signature} source=${tx.source ?? "unknown"} type=${tx.type ?? "unknown"} accountDataCount=${tx.accountData?.length ?? 0}`
      );
      continue;
    }

    await ctx.runMutation(internal.activity.storeSwapPayload, {
      signature: tx.signature,
      source: tx.source,
      type: tx.type,
      timestamp: tx.timestamp * 1000,
      rawJson: JSON.stringify(tx),
    });

    const pythEvents = extractPythEvents(tx.accountData ?? [], tx.tokenTransfers ?? [], PYTH_MINT, {
      feePayer: tx.feePayer,
    });

    if (pythEvents.length === 0) {
      console.log(
        `[pyth-webhook] skipped sig=${tx.signature} source=${tx.source ?? "unknown"} type=${tx.type ?? "unknown"} accountDataCount=${tx.accountData?.length ?? 0}`
      );
    }

    for (const event of pythEvents) {
      console.log(
        `[pyth-webhook] classified sig=${tx.signature} wallet=${event.walletAddress} direction=${event.direction} pythAmount=${event.pythAmount} matchedVia=${event.matchedVia}`
      );
      await ctx.runMutation(internal.activity.storePythEvent, {
        signature: tx.signature,
        walletAddress: event.walletAddress,
        direction: event.direction,
        pythAmount: event.pythAmount,
        timestamp: tx.timestamp * 1000,
      });
    }
  }

  return new Response("OK", { status: 200 });
});

export const storePythEvent = internalMutation({
  args: {
    signature: v.string(),
    walletAddress: v.string(),
    direction: v.union(v.literal("buy"), v.literal("sell")),
    pythAmount: v.number(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pyth_events")
      .withIndex("by_signature_wallet_direction", (q) =>
        q.eq("signature", args.signature)
          .eq("walletAddress", args.walletAddress)
          .eq("direction", args.direction)
      )
      .first();

    if (existing) return;

    await ctx.db.insert("pyth_events", args);
  },
});

export const storeSwapPayload = internalMutation({
  args: {
    signature: v.string(),
    source: v.optional(v.string()),
    type: v.optional(v.string()),
    timestamp: v.number(),
    rawJson: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pyth_swap_payloads")
      .withIndex("by_signature", (q) => q.eq("signature", args.signature))
      .first();

    if (existing) return;

    await ctx.db.insert("pyth_swap_payloads", args);
  },
});

export const getSellEvents = query({
  args: { paginationOpts: paginationOptsValidator, tier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("pyth_events")
      .withIndex("by_direction_and_timestamp", (q) => q.eq("direction", "sell"))
      .order("desc")
      .filter((q) =>
        args.tier === undefined
          ? q.gte(q.field("pythAmount"), 10_000)
          : args.tier === "dolphin"
            ? q.and(q.gte(q.field("pythAmount"), 10_000), q.lte(q.field("pythAmount"), 50_000))
            : q.gt(q.field("pythAmount"), 50_000)
      )
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map(toFeedEvent),
    };
  },
});

export const getBuyEvents = query({
  args: { paginationOpts: paginationOptsValidator, tier: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("pyth_events")
      .withIndex("by_direction_and_timestamp", (q) => q.eq("direction", "buy"))
      .order("desc")
      .filter((q) =>
        args.tier === undefined
          ? q.gte(q.field("pythAmount"), 10_000)
          : args.tier === "dolphin"
            ? q.and(q.gte(q.field("pythAmount"), 10_000), q.lte(q.field("pythAmount"), 50_000))
            : q.gt(q.field("pythAmount"), 50_000)
      )
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map(toFeedEvent),
    };
  },
});

export const getSellsSummary = query({
  args: {},
  handler: async (ctx) => {
    const events = await collectDirectionEvents(ctx, "sell");
    const now = Date.now();
    return {
      last24h: (() => {
        const result = summarize(events.filter((event: StoredPythEvent) => event.timestamp >= now - 24 * 60 * 60 * 1000));
        return {
          totalPythSold: result.total,
          totalPythSoldAllTiers: result.totalAllTiers,
          eventCount: result.eventCount,
        };
      })(),
      last7d: (() => {
        const result = summarize(events.filter((event: StoredPythEvent) => event.timestamp >= now - 7 * 24 * 60 * 60 * 1000));
        return {
          totalPythSold: result.total,
          totalPythSoldAllTiers: result.totalAllTiers,
          eventCount: result.eventCount,
        };
      })(),
      last30d: (() => {
        const result = summarize(events.filter((event: StoredPythEvent) => event.timestamp >= now - 30 * 24 * 60 * 60 * 1000));
        return {
          totalPythSold: result.total,
          totalPythSoldAllTiers: result.totalAllTiers,
          eventCount: result.eventCount,
        };
      })(),
    };
  },
});

export const getBuysSummary = query({
  args: {},
  handler: async (ctx) => {
    const events = await collectDirectionEvents(ctx, "buy");
    const now = Date.now();
    return {
      last24h: (() => {
        const result = summarize(events.filter((event: StoredPythEvent) => event.timestamp >= now - 24 * 60 * 60 * 1000));
        return {
          totalPythBought: result.total,
          totalPythBoughtAllTiers: result.totalAllTiers,
          eventCount: result.eventCount,
        };
      })(),
      last7d: (() => {
        const result = summarize(events.filter((event: StoredPythEvent) => event.timestamp >= now - 7 * 24 * 60 * 60 * 1000));
        return {
          totalPythBought: result.total,
          totalPythBoughtAllTiers: result.totalAllTiers,
          eventCount: result.eventCount,
        };
      })(),
      last30d: (() => {
        const result = summarize(events.filter((event: StoredPythEvent) => event.timestamp >= now - 30 * 24 * 60 * 60 * 1000));
        return {
          totalPythBought: result.total,
          totalPythBoughtAllTiers: result.totalAllTiers,
          eventCount: result.eventCount,
        };
      })(),
    };
  },
});

export const getWhaleSellEvents = query({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const events = await ctx.db
      .query("pyth_events")
      .withIndex("by_direction_and_timestamp", (q) => q.eq("direction", "sell").gte("timestamp", thirtyDaysAgo))
      .order("desc")
      .collect();

    return events
      .filter((event) => assignTier(event.pythAmount) === "whale")
      .slice(0, 20)
      .map(toFeedEvent);
  },
});

export const getWhaleBuyEvents = query({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const events = await ctx.db
      .query("pyth_events")
      .withIndex("by_direction_and_timestamp", (q) => q.eq("direction", "buy").gte("timestamp", thirtyDaysAgo))
      .order("desc")
      .collect();

    return events
      .filter((event) => assignTier(event.pythAmount) === "whale")
      .slice(0, 20)
      .map(toFeedEvent);
  },
});

export const getSellsAnalytics = query({
  args: { window: v.union(v.literal("7d"), v.literal("30d"), v.literal("all")) },
  handler: async (ctx, args) => {
    const events = await collectDirectionEvents(ctx, "sell");
    const now = Date.now();
    const filtered = events.filter((event: StoredPythEvent) =>
      args.window === "all"
        ? true
        : args.window === "7d"
          ? event.timestamp >= now - 7 * 24 * 60 * 60 * 1000
          : event.timestamp >= now - 30 * 24 * 60 * 60 * 1000
    );
    return analytics(filtered);
  },
});

export const getBuysAnalytics = query({
  args: { window: v.union(v.literal("7d"), v.literal("30d"), v.literal("all")) },
  handler: async (ctx, args) => {
    const events = await collectDirectionEvents(ctx, "buy");
    const now = Date.now();
    const filtered = events.filter((event: StoredPythEvent) =>
      args.window === "all"
        ? true
        : args.window === "7d"
          ? event.timestamp >= now - 7 * 24 * 60 * 60 * 1000
          : event.timestamp >= now - 30 * 24 * 60 * 60 * 1000
    );
    return analytics(filtered);
  },
});

export const getTrackingStartDate = query({
  args: {},
  handler: async (ctx) => {
    const firstEvent = await ctx.db.query("pyth_events").withIndex("by_timestamp").order("asc").first();
    return firstEvent?.timestamp ?? null;
  },
});

export const getRecentSwapPayloads = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pyth_swap_payloads")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 10);
  },
});
