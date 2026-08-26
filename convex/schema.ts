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
  pythProReports: defineTable({
    topicId: v.number(),
    title: v.string(),
    slug: v.string(),
    url: v.string(),
    authorUsername: v.string(),
    createdAtMs: v.number(),
    lastPostedAtMs: v.number(),
    highestPostNumber: v.number(),
    reportPeriodLabel: v.optional(v.string()),
    distribution: v.optional(
      v.object({
        tokenAmount: v.optional(v.number()),
        usdValue: v.optional(v.number()),
        tokenSymbol: v.union(v.literal("PYTH"), v.literal("USDC")),
        twapUsd: v.optional(v.number()),
        pythPerUsd: v.optional(v.number()),
      })
    ),
    monthlyRevenueRows: v.array(
      v.object({
        product: v.string(),
        splitLabel: v.optional(v.string()),
        grossRevenueUsd: v.optional(v.number()),
        daoShareUsd: v.optional(v.number()),
        daoSharePyth: v.optional(v.number()),
        douroLabsUsd: v.optional(v.number()),
        isTotal: v.boolean(),
      })
    ),
    cumulativeRevenueRows: v.array(
      v.object({
        product: v.string(),
        splitLabel: v.optional(v.string()),
        grossRevenueUsd: v.optional(v.number()),
        daoShareUsd: v.optional(v.number()),
        daoSharePyth: v.optional(v.number()),
        douroLabsUsd: v.optional(v.number()),
        isTotal: v.boolean(),
      })
    ),
    legacySummaryRows: v.array(
      v.object({
        label: v.string(),
        usdValue: v.number(),
      })
    ),
    monthlyGrossRevenueUsd: v.optional(v.number()),
    monthlyDaoShareUsd: v.optional(v.number()),
    monthlyDouroLabsUsd: v.optional(v.number()),
    cumulativeGrossRevenueUsd: v.optional(v.number()),
    cumulativeDaoShareUsd: v.optional(v.number()),
    cumulativeDouroLabsUsd: v.optional(v.number()),
    rawCooked: v.string(),
    syncedAtMs: v.number(),
  })
    .index("by_topicId", ["topicId"])
    .index("by_createdAtMs", ["createdAtMs"])
    .index("by_lastPostedAtMs", ["lastPostedAtMs"]),
});
