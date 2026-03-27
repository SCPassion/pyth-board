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
      shrimp: v.number(),
      dolphin: v.number(),
      whale: v.number(),
    }),
    pythVolumeByTier: v.object({
      shrimp: v.optional(v.number()),
      dolphin: v.number(),
      whale: v.number(),
    }),
  })
    .index("by_date", ["date"]),
  buy_events: defineTable({
    // fromAddress = buyer's wallet address.
    // Named fromAddress (not toAddress) to mirror sell_events.fromAddress.
    // In both tables, fromAddress means "the user who initiated the swap."
    // BuyData.toAddress is mapped to this field in storeBuyEvent.
    fromAddress: v.string(),
    signature: v.string(),
    pythAmount: v.number(),
    fromToken: v.string(),         // token spent to buy PYTH
    fromTokenSymbol: v.optional(v.string()),
    fromAmount: v.number(),
    tier: v.string(),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_signature", ["signature"])
    .index("by_address", ["fromAddress"])
    .index("by_tier_and_timestamp", ["tier", "timestamp"]),
  buys_daily: defineTable({
    date: v.string(),
    totalPythBought: v.number(),   // excludes shrimp — same rule as sells_daily.totalPythSold
    eventCount: v.number(),        // excludes shrimp — same rule as sells_daily.eventCount
    byTier: v.object({
      // byTier DOES include shrimp — shrimp event counts are tracked here even though
      // shrimp is excluded from totalPythBought/eventCount above.
      shrimp: v.number(),
      dolphin: v.number(),
      whale: v.number(),
    }),
    // All three fields are v.number() (NOT optional). buys_daily is a brand-new table
    // with no pre-existing rows, so v.optional is not needed for backward compat.
    // Contrast: sells_daily.pythVolumeByTier.shrimp is v.optional because it was
    // added retroactively after rows without the field already existed.
    pythVolumeByTier: v.object({
      shrimp: v.number(),
      dolphin: v.number(),
      whale: v.number(),
    }),
  }).index("by_date", ["date"]),
});
