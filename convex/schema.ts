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
    totalUsdcSpentLimitOrders: v.optional(v.number()),
    totalPythBoughtLimitOrders: v.optional(v.number()),
  }).index("by_key", ["key"]),
  newsSourceItems: defineTable({
    source: v.string(),
    category: v.string(),
    topicId: v.number(),
    postId: v.number(),
    topicTitle: v.string(),
    topicSlug: v.string(),
    url: v.string(),
    authorUsername: v.string(),
    authorName: v.optional(v.string()),
    createdAtMs: v.number(),
    weekKey: v.string(),
    isTopicOp: v.boolean(),
    isNewTopicThisWeek: v.boolean(),
    contentText: v.string(),
    rawJson: v.string(),
    signalScore: v.number(),
  })
    .index("by_weekKey", ["weekKey"])
    .index("by_topicId", ["topicId"])
    .index("by_source_and_weekKey", ["source", "weekKey"]),
  newsDigests: defineTable({
    weekKey: v.string(),
    rangeStartMs: v.number(),
    rangeEndMs: v.number(),
    status: v.string(),
    title: v.string(),
    summary: v.string(),
    sections: v.array(
      v.object({
        title: v.string(),
        summary: v.optional(v.string()),
        bullets: v.optional(v.array(v.string())),
        sources: v.optional(
          v.array(
            v.object({
              label: v.string(),
              url: v.string(),
            })
          )
        ),
      })
    ),
    sourceCounts: v.object({
      forumPosts: v.number(),
      forumTopics: v.number(),
    }),
    model: v.string(),
    promptVersion: v.string(),
    generatedAtMs: v.number(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_weekKey", ["weekKey"])
    .index("by_generatedAtMs", ["generatedAtMs"]),
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
});
