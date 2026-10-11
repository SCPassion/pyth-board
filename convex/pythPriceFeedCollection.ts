import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { fetchPriceFeedCounts, validatePriceFeedDate } from "../lib/growth/priceFeeds";

const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000];

export const collect = internalAction({
  args: { date: v.optional(v.string()), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const today = new Date().toISOString().slice(0, 10);
    const date = args.date ?? today;
    const attempt = args.attempt ?? 0;
    validatePriceFeedDate(date);
    if (!Number.isInteger(attempt) || attempt < 0 || attempt > RETRY_DELAYS_MS.length) {
      throw new Error("Invalid price-feed collection attempt");
    }
    // Delayed retries never create a snapshot for a different UTC day.
    if (date !== today || await ctx.runQuery(internal.pythPriceFeeds.hasDate, { date })) return null;
    try {
      const counts = await fetchPriceFeedCounts();
      const collectedAt = Date.now();
      if (new Date(collectedAt).toISOString().slice(0, 10) !== date) throw new Error("Price-feed collection crossed UTC midnight");
      await ctx.runMutation(internal.pythPriceFeeds.store, { ...counts, collectedAt });
      console.info("Price-feed snapshot collected", { date, ...counts });
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) throw error;
      console.warn("Price-feed collection failed; scheduling retry", { date, attempt, error: error instanceof Error ? error.message : "Unknown error" });
      await ctx.scheduler.runAfter(delay, internal.pythPriceFeedCollection.collect, { date, attempt: attempt + 1 });
    }
    return null;
  },
});
