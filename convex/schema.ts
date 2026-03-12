import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  pythHoldingSnapshots: defineTable({
    timestampMs: v.number(),
    minuteBucketMs: v.number(),
    totalPythHeld: v.number(),
  })
    .index("by_minuteBucketMs", ["minuteBucketMs"])
    .index("by_timestampMs", ["timestampMs"]),
  pythBuybackSnapshots: defineTable({
    timestampMs: v.number(),
    minuteBucketMs: v.number(),
    totalUsdcSpent: v.number(),
    totalPythBought: v.number(),
    avgBuyPriceUsd: v.number(),
  })
    .index("by_minuteBucketMs", ["minuteBucketMs"])
    .index("by_timestampMs", ["timestampMs"]),
  pythBuybackState: defineTable({
    key: v.string(),
    latestProcessedSignature: v.optional(v.string()),
    totalUsdcSpent: v.number(),
    totalPythBought: v.number(),
    totalUsdcSpentDirect: v.optional(v.number()),
    totalPythBoughtDirect: v.optional(v.number()),
    totalUsdcSpentDca: v.optional(v.number()),
    totalPythBoughtDca: v.optional(v.number()),
  }).index("by_key", ["key"]),
});
