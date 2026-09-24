import { trackerMetricsFields } from "./trackerModel";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { trade, totals, product, side, nullableNumber } from "./trackerModel";
import { WINDOWS, PRODUCTS } from "../lib/tracker/config";
import {
  addTotals,
  emptyTotals,
  contribution,
  bucketStart,
  HOUR,
  eligibleOwner,
} from "../lib/tracker/analytics";
import type { Trade } from "../lib/tracker/types";
const windowValidator = v.union(
  v.literal("1h"),
  v.literal("6h"),
  v.literal("24h"),
  v.literal("7d"),
  v.literal("30d"),
  v.literal("since"),
);
async function rangeStart(ctx: QueryCtx, window: keyof typeof WINDOWS | "since", to: number) {
  if (window !== "since") return to - WINDOWS[window];
  const state = await ctx.db
    .query("trackerState")
    .withIndex("by_key", (q) => q.eq("key", "main"))
    .unique();
  return state?.activationTime ?? to - WINDOWS["24h"];
}
function publicTrade(t: Trade): Trade {
  return Object.fromEntries(
    Object.keys(trade.fields)
      .filter((k) => t[k as keyof Trade] !== undefined)
      .map((k) => [k, t[k as keyof Trade]]),
  ) as Trade;
}
export const health = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    fullCoverage: v.boolean(),
    activationTime: nullableNumber,
    lastWebhookAt: nullableNumber,
    lastReconciledAt: nullableNumber,
    lastProcessedAt: nullableNumber,
    oldestPendingAt: nullableNumber,
    needsReview: v.boolean(),
    hasParserReview: v.boolean(),
    hasFailed: v.boolean(),
  }),
  handler: async (ctx) => {
    const state = await ctx.db
      .query("trackerState")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    const pending = await Promise.all(
      (["DISCOVERED", "RETRY", "FETCHING"] as const).map((status) =>
        ctx.db
          .query("chainTransactions")
          .withIndex("by_status_and_firstSeenAt", (q) => q.eq("status", status))
          .first(),
      ),
    );
    const times = pending.flatMap((row) => (row ? [row.firstSeenAt] : []));
    const review = await ctx.db
      .query("chainTransactions")
      .withIndex("by_status_and_firstSeenAt", (q) =>
        q.eq("status", "PARSE_REVIEW"),
      )
      .first();
    const failed = await ctx.db
      .query("chainTransactions")
      .withIndex("by_status_and_firstSeenAt", (q) => q.eq("status", "FAILED"))
      .first();
    return {
      oldestPendingAt: times.length ? Math.min(...times) : null,
      needsReview: !!review || !!failed,
      hasParserReview: !!review,
      hasFailed: !!failed,
      enabled: !!(state?.enabled || state?.webhookEnabled),
      fullCoverage: state?.enabled ?? false,
      activationTime: state?.activationTime ?? null,
      lastWebhookAt: state?.lastWebhookAt ?? null,
      lastReconciledAt: state?.lastReconciledAt ?? null,
      lastProcessedAt: state?.lastProcessedAt ?? null,
    };
  },
});
export const recent = query({
  args: {
    paginationOpts: paginationOptsValidator,
    side: v.optional(side),
    product: v.optional(product),
    from: v.number(),
    to: v.number(),
  },
  returns: v.object({
    page: v.array(trade),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    if (args.to <= args.from || !Number.isFinite(args.from) || !Number.isFinite(args.to))
      throw new Error("Invalid time range");
    if (args.to - args.from > WINDOWS["30d"]) {
      const state = await ctx.db
        .query("trackerState")
        .withIndex("by_key", (q) => q.eq("key", "main"))
        .unique();
      if (!state?.activationTime || args.from < state.activationTime)
        throw new Error("Invalid time range");
    }
    const opts = {
      ...args.paginationOpts,
      numItems: Math.min(50, Math.max(1, args.paginationOpts.numItems)),
    };
    const q = ctx.db.query("pythTrades");
    const indexed =
      args.side && args.product
        ? q.withIndex("by_side_and_product_and_blockTime", (q) =>
            q
              .eq("side", args.side!)
              .eq("product", args.product!)
              .gte("blockTime", args.from)
              .lt("blockTime", args.to),
          )
        : args.side
          ? q.withIndex("by_side_and_blockTime", (q) =>
              q
                .eq("side", args.side!)
                .gte("blockTime", args.from)
                .lt("blockTime", args.to),
            )
          : args.product
            ? q.withIndex("by_product_and_blockTime", (q) =>
                q
                  .eq("product", args.product!)
                  .gte("blockTime", args.from)
                  .lt("blockTime", args.to),
              )
            : q.withIndex("by_blockTime", (q) =>
                q.gte("blockTime", args.from).lt("blockTime", args.to),
              );
    const result = await indexed.order("desc").paginate(opts);
    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map(publicTrade),
    };
  },
});
export const bySignature = query({
  args: { signature: v.string() },
  returns: v.array(trade),
  handler: async (ctx, { signature }) =>
    (
      await ctx.db
        .query("pythTrades")
        .withIndex("by_signature", (q) => q.eq("signature", signature))
        .take(32)
    ).map(publicTrade),
});
export const walletHistory = query({
  args: { owner: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(trade),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("pythTrades")
      .withIndex("by_owner_and_blockTime", (q) => q.eq("owner", args.owner))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(50, args.paginationOpts.numItems),
      });
    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.filter(eligibleOwner).map(publicTrade),
    };
  },
});
export const overview = query({
  args: { window: windowValidator, to: v.number() },
  returns: v.object({
    summary: totals,
    series: v.array(v.object({ time: v.number(), ...totals.fields })),
    products: v.array(v.object({ product, ...totals.fields })),
    complete: v.boolean(),
    from: v.number(),
    to: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.to)) throw new Error("Invalid window end");
    const from = await rangeStart(ctx, args.window, args.to),
      start = bucketStart(from) + HOUR,
      end = bucketStart(args.to);
    const daily = args.window === "since" && args.to - from > WINDOWS["30d"];
    const chartBucket = (time: number) =>
      daily ? Math.floor(time / WINDOWS["24h"]) * WINDOWS["24h"] : bucketStart(time);
    const maxBuckets = args.window === "since" ? 8000 : 3000;
    const buckets =
      end > start
        ? await ctx.db
            .query("tradeBuckets")
            .withIndex("by_bucketStart", (q) =>
              q.gte("bucketStart", start).lt("bucketStart", end),
            )
            .take(maxBuckets + 1)
        : [];
    const first = await ctx.db
      .query("pythTrades")
      .withIndex("by_blockTime", (q) =>
        q.gte("blockTime", from).lt("blockTime", Math.min(start, args.to)),
      )
      .take(2001);
    const last =
      end >= start && end < args.to
        ? await ctx.db
            .query("pythTrades")
            .withIndex("by_blockTime", (q) =>
              q.gte("blockTime", end).lt("blockTime", args.to),
            )
            .take(2001)
        : [];
    const complete = buckets.length <= maxBuckets && first.length <= 2000 && last.length <= 2000;
    if (!complete)
      return {
        summary: emptyTotals(),
        series: [],
        products: PRODUCTS.map((product) => ({ product, ...emptyTotals() })),
        complete: false,
        from,
        to: args.to,
      };
    let summary = emptyTotals();
    const products = new Map(PRODUCTS.map((p) => [p, emptyTotals()]));
    const series = new Map<number, ReturnType<typeof emptyTotals>>();
    const add = (
      time: number,
      p: (typeof PRODUCTS)[number],
      value: ReturnType<typeof emptyTotals>,
    ) => {
      summary = addTotals(summary, value);
      products.set(p, addTotals(products.get(p)!, value));
      series.set(time, addTotals(series.get(time) ?? emptyTotals(), value));
    };
    for (const b of buckets) add(chartBucket(b.bucketStart), b.product, b);
    for (const t of [...first, ...last])
      add(chartBucket(t.blockTime), t.product, contribution(t));
    return {
      summary,
      series: [...series]
        .sort((a, b) => a[0] - b[0])
        .map(([time, t]) => ({ time, ...t })),
      products: [...products].map(([product, t]) => ({ product, ...t })),
      complete,
      from,
      to: args.to,
    };
  },
});
export const ownerOverview = query({
  args: {
    owner: v.optional(v.string()),
    owners: v.optional(v.array(v.string())),
    window: windowValidator,
    to: v.number(),
  },
  returns: v.object({
    summary: totals,
    series: v.array(v.object({ time: v.number(), ...totals.fields })),
    complete: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.to)) throw new Error("Invalid window end");
    const owners = [...new Set([
      ...(args.owner ? [args.owner] : []),
      ...(args.owners ?? []),
    ])];
    if (owners.length > 10 || owners.some((owner) => !owner || owner.length > 64))
      throw new Error("Invalid owner list");
    const from = await rangeStart(ctx, args.window, args.to),
      start = bucketStart(from) + HOUR,
      end = bucketStart(args.to);
    const daily = args.window === "since" && args.to - from > WINDOWS["30d"];
    const chartBucket = (time: number) =>
      daily ? Math.floor(time / WINDOWS["24h"]) * WINDOWS["24h"] : bucketStart(time);
    let summary = emptyTotals();
    const series = new Map<number, ReturnType<typeof emptyTotals>>();
    const add = (time: number, value: ReturnType<typeof emptyTotals>) => {
      summary = addTotals(summary, value);
      series.set(time, addTotals(series.get(time) ?? emptyTotals(), value));
    };
    let bucketCount = 0;
    let boundaryCount = 0;
    for (const owner of owners) {
      const buckets =
        end > start
          ? await ctx.db
              .query("tradeOwnerBuckets")
              .withIndex("by_owner_and_bucketStart", (q) =>
                q.eq("owner", owner).gte("bucketStart", start).lt("bucketStart", end),
              )
              .take(8001 - bucketCount)
          : [];
      bucketCount += buckets.length;
      if (bucketCount > 8000)
        return { summary: emptyTotals(), series: [], complete: false };
      const first = await ctx.db
        .query("pythTrades")
        .withIndex("by_owner_and_blockTime", (q) =>
          q.eq("owner", owner).gte("blockTime", from).lt("blockTime", Math.min(start, args.to)),
        )
        .take(2001 - boundaryCount);
      boundaryCount += first.length;
      if (boundaryCount > 2000)
        return { summary: emptyTotals(), series: [], complete: false };
      const last =
        end >= start && end < args.to
          ? await ctx.db
              .query("pythTrades")
              .withIndex("by_owner_and_blockTime", (q) =>
                q.eq("owner", owner).gte("blockTime", end).lt("blockTime", args.to),
              )
              .take(2001 - boundaryCount)
          : [];
      boundaryCount += last.length;
      if (boundaryCount > 2000)
        return { summary: emptyTotals(), series: [], complete: false };
      for (const bucket of buckets) add(chartBucket(bucket.bucketStart), bucket);
      for (const trade of [...first, ...last])
        if (eligibleOwner(trade)) add(chartBucket(trade.blockTime), contribution(trade));
    }
    return {
      summary,
      series: [...series]
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time, ...value })),
      complete: true,
    };
  },
});
export const rankings = query({
  args: {
    window: windowValidator,
    to: v.number(),
    excludeOwner: v.optional(v.string()),
    excludeOwners: v.optional(v.array(v.string())),
  },
  returns: v.object({
    buyers: v.array(v.object({ owner: v.string(), ...totals.fields })),
    sellers: v.array(v.object({ owner: v.string(), ...totals.fields })),
    complete: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.to)) throw new Error("Invalid window end");
    const excluded = new Set([
      ...(args.excludeOwner ? [args.excludeOwner] : []),
      ...(args.excludeOwners ?? []),
    ]);
    if (excluded.size > 10) throw new Error("Too many excluded owners");
    const from = await rangeStart(ctx, args.window, args.to),
      start = bucketStart(from) + HOUR,
      end = bucketStart(args.to);
    const buckets =
      end > start
        ? await ctx.db
            .query("tradeOwnerBuckets")
            .withIndex("by_bucketStart", (q) =>
              q.gte("bucketStart", start).lt("bucketStart", end),
            )
            .take(8001)
        : [];
    const first = await ctx.db
      .query("pythTrades")
      .withIndex("by_blockTime", (q) =>
        q.gte("blockTime", from).lt("blockTime", Math.min(start, args.to)),
      )
      .take(2001);
    const last =
      end >= start && end < args.to
        ? await ctx.db
            .query("pythTrades")
            .withIndex("by_blockTime", (q) =>
              q.gte("blockTime", end).lt("blockTime", args.to),
            )
            .take(2001)
        : [];
    if (buckets.length > 8000 || first.length > 2000 || last.length > 2000)
      return { buyers: [], sellers: [], complete: false };
    const owners = new Map<string, ReturnType<typeof emptyTotals>>();
    for (const b of buckets)
      owners.set(b.owner, addTotals(owners.get(b.owner) ?? emptyTotals(), b));
    for (const t of [...first, ...last])
      if (eligibleOwner(t))
        owners.set(
          t.owner!,
          addTotals(owners.get(t.owner!) ?? emptyTotals(), contribution(t)),
        );
    const rows = [...owners]
      .filter(([owner]) => !excluded.has(owner))
      .map(([owner, t]) => ({ owner, ...t }));
    const net = (t: (typeof rows)[number]) =>
      BigInt(t.buyRaw) - BigInt(t.sellRaw);
    rows.sort((a, b) =>
      net(a) > net(b)
        ? -1
        : net(a) < net(b)
          ? 1
          : a.owner.localeCompare(b.owner),
    );
    return {
      buyers: rows.filter((t) => net(t) > 0n).slice(0, 10),
      sellers: rows
        .filter((t) => net(t) < 0n)
        .reverse()
        .slice(0, 10),
      complete: true,
    };
  },
});
export const diagnostics = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.union(
      v.literal("FAILED"),
      v.literal("PARSE_REVIEW"),
      v.literal("RETRY"),
    ),
  },
  returns: v.object({
    page: v.array(
      v.object({
        signature: v.string(),
        attempts: v.number(),
        error: v.union(v.string(), v.null()),
        firstSeenAt: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const r = await ctx.db
      .query("chainTransactions")
      .withIndex("by_status_and_nextAttemptAt", (q) =>
        q.eq("status", args.status),
      )
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(50, args.paginationOpts.numItems),
      });
    return {
      isDone: r.isDone,
      continueCursor: r.continueCursor,
      page: r.page.map(({ signature, attempts, error, firstSeenAt }) => ({
        signature,
        attempts,
        error,
        firstSeenAt,
      })),
    };
  },
});

export const metrics = internalQuery({
  args: { from: v.number(), to: v.number() },
  returns: v.array(
    v.object({ bucketStart: v.number(), ...trackerMetricsFields }),
  ),
  handler: async (ctx, args) => {
    if (args.to <= args.from || args.to - args.from > WINDOWS["30d"])
      throw new Error("Invalid metrics range");
    const rows = await ctx.db
      .query("trackerMetrics")
      .withIndex("by_bucketStart", (q) =>
        q
          .gte("bucketStart", bucketStart(args.from))
          .lte("bucketStart", args.to),
      )
      .take(721);
    return rows.map(
      ({
        bucketStart,
        candidates,
        processed,
        reviews,
        failures,
        retries,
        reconciliationDiscoveries,
      }) => ({
        bucketStart,
        candidates,
        processed,
        reviews,
        failures,
        retries,
        reconciliationDiscoveries,
      }),
    );
  },
});
