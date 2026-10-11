import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { validatePriceFeedCounts, validatePriceFeedDate } from "../lib/growth/priceFeeds";

const snapshot = v.object({
  date: v.string(), stable: v.number(), comingSoon: v.number(), inactive: v.number(), collectedAt: v.number(),
});

export const store = internalMutation({
  args: { stable: v.number(), comingSoon: v.number(), inactive: v.number(), collectedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    validatePriceFeedCounts(args);
    if (!Number.isSafeInteger(args.collectedAt) || args.collectedAt <= 0 || args.collectedAt > 8_640_000_000_000_000) {
      throw new Error("Invalid price-feed collection timestamp");
    }
    const date = new Date(args.collectedAt).toISOString().slice(0, 10);
    validatePriceFeedDate(date);
    const existing = await ctx.db.query("pythPriceFeedSnapshots").withIndex("by_date", q => q.eq("date", date)).unique();
    // Retain the first successful observation, even when retries/manual runs overlap.
    if (!existing) await ctx.db.insert("pythPriceFeedSnapshots", { date, ...args });
    return null;
  },
});

export const hasDate = internalQuery({
  args: { date: v.string() }, returns: v.boolean(),
  handler: async (ctx, { date }) => {
    validatePriceFeedDate(date);
    return (await ctx.db.query("pythPriceFeedSnapshots").withIndex("by_date", q => q.eq("date", date)).unique()) !== null;
  },
});

export const latest = query({
  args: {}, returns: v.union(snapshot, v.null()),
  handler: async ctx => {
    const row = await ctx.db.query("pythPriceFeedSnapshots").withIndex("by_date").order("desc").first();
    return row ? { date: row.date, stable: row.stable, comingSoon: row.comingSoon, inactive: row.inactive, collectedAt: row.collectedAt } : null;
  },
});

export const history = query({
  args: { since: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(snapshot), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, { since, paginationOpts }) => {
    validatePriceFeedDate(since);
    const result = await ctx.db.query("pythPriceFeedSnapshots")
      .withIndex("by_date", q => q.gte("date", since)).order("asc")
      .paginate({ ...paginationOpts, numItems: Math.min(paginationOpts.numItems, 366) });
    return {
      isDone: result.isDone, continueCursor: result.continueCursor,
      page: result.page.map(({ date, stable, comingSoon, inactive, collectedAt }) => ({ date, stable, comingSoon, inactive, collectedAt })),
    };
  },
});
