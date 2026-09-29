import { v } from "convex/values";

export const holderBalance = v.object({ owner: v.string(), amount: v.string() });
export const holderPeriod = v.union(v.literal(1), v.literal(7), v.literal(30));
export const holderComparison = v.object({
  days: holderPeriod, date: v.string(), collectedAt: v.union(v.number(), v.null()),
  status: v.union(v.literal("ready"), v.literal("collecting"), v.literal("missing")),
});
export const holderLeaderboardEntry = v.object({
  owner: v.string(), amount: v.string(), rank: v.number(),
  changes: v.array(v.object({ days: holderPeriod, amountDelta: v.union(v.string(), v.null()),
    filteredRankDelta: v.optional(v.union(v.number(), v.null())), percentageDelta: v.union(v.string(), v.null()), rankDelta: v.union(v.number(), v.null()),
  })),
});
