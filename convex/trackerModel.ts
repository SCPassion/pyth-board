import { v } from "convex/values";
import { defineTable } from "convex/server";
export const movementAccounting = v.object({
  signature: v.string(),
  slot: v.number(),
  blockTime: v.number(),
  parserVersion: v.number(),
  status: v.union(
    v.literal("RECONCILED"),
    v.literal("PARTIAL"),
    v.literal("UNAVAILABLE"),
  ),
  issues: v.array(v.string()),
  balances: v.array(
    v.object({
      tokenAccount: v.string(),
      owner: v.union(v.string(), v.null()),
      preRaw: v.union(v.string(), v.null()),
      postRaw: v.union(v.string(), v.null()),
      deltaRaw: v.union(v.string(), v.null()),
    }),
  ),
  transfers: v.array(
    v.object({
      instructionIndex: v.number(),
      innerInstructionIndex: v.union(v.number(), v.null()),
      source: v.string(),
      destination: v.string(),
      authority: v.string(),
      amountRaw: v.string(),
    }),
  ),
});
export const product = v.union(
  v.literal("SWAP"),
  v.literal("RECURRING"),
  v.literal("TRIGGER"),
  v.literal("UNKNOWN_JUPITER"),
);
export const confidence = v.union(
  v.literal("HIGH"),
  v.literal("MEDIUM"),
  v.literal("LOW"),
  v.literal("UNRESOLVED"),
);
export const nullableString = v.union(v.string(), v.null());
export const nullableNumber = v.union(v.number(), v.null());
export const side = v.union(v.literal("BUY"), v.literal("SELL"));
export const routeLeg = v.object({
  inputMint: v.string(),
  outputMint: v.string(),
  inputAmountRaw: v.string(),
  outputAmountRaw: v.string(),
  dexProgramId: nullableString,
  dexName: nullableString,
});
export const tradeFields = {
  router: v.optional(v.string()),
  tradeId: v.string(),
  signature: v.string(),
  slot: v.number(),
  blockTime: v.number(),
  side,
  inputMint: v.string(),
  outputMint: v.string(),
  inputAmountRaw: v.string(),
  outputAmountRaw: v.string(),
  pythAmountRaw: v.string(),
  counterMint: v.string(),
  counterAmountRaw: v.string(),
  counterDecimals: v.number(),
  product,
  owner: nullableString,
  ownerConfidence: confidence,
  classificationConfidence: v.union(v.literal("HIGH"), v.literal("MEDIUM")),
  executionProgramId: v.string(),
  executionAuthority: nullableString,
  orderKey: nullableString,
  routeLegs: v.array(routeLeg),
  flags: v.array(v.string()),
  parserVersion: v.number(),
  usdValue: nullableNumber,
  priceUsd: nullableNumber,
  priceTimestamp: nullableNumber,
  priceSource: nullableString,
};
export const trade = v.object(tradeFields);
export const arbitrage = v.object({
  kind: v.literal("ARBITRAGE_WITH_HOST_FEE"),
  executionId: v.string(),
  signature: v.string(),
  slot: v.number(),
  blockTime: v.number(),
  executionProgramId: v.string(),
  executionAuthority: v.string(),
  parserVersion: v.number(),
  settlements: v.array(
    v.object({
      mint: v.string(),
      decimals: v.number(),
      tokenAccount: v.string(),
      debitRaw: v.string(),
      creditRaw: v.string(),
      netRaw: v.string(),
    }),
  ),
  hostFee: v.object({
    mint: v.string(),
    amountRaw: v.string(),
    tokenAccount: v.string(),
    programId: v.string(),
  }),
  routeLegs: v.array(routeLeg),
});
export const program = v.object({
  programId: v.string(),
  product,
  instructionNames: v.array(v.string()),
  ownerRole: nullableString,
  orderRole: nullableString,
  verified: v.boolean(),
});
export const order = v.object({
  orderKey: v.string(),
  owner: v.string(),
  product,
  programId: v.string(),
  sourceSignature: v.string(),
});
export const status = v.union(
  v.literal("DISCOVERED"),
  v.literal("FETCHING"),
  v.literal("STORED"),
  v.literal("IGNORED"),
  v.literal("RETRY"),
  v.literal("FAILED"),
  v.literal("PARSE_REVIEW"),
);
export const totalsFields = {
  buyRaw: v.string(),
  sellRaw: v.string(),
  buyUsd: v.number(),
  sellUsd: v.number(),
  buyCount: v.number(),
  sellCount: v.number(),
  valuedCount: v.number(),
  unresolvedCount: v.number(),
};
export const totals = v.object(totalsFields);
export const trackerMetricsFields = {
  candidates: v.number(),
  processed: v.number(),
  reviews: v.number(),
  failures: v.number(),
  retries: v.number(),
  reconciliationDiscoveries: v.number(),
};
export const trackerTables = {
  trackerMetrics: defineTable({
    bucketStart: v.number(),
    ...trackerMetricsFields,
  }).index("by_bucketStart", ["bucketStart"]),
  trackerState: defineTable({
    key: v.string(),
    enabled: v.boolean(),
    webhookEnabled: v.optional(v.boolean()),
    drainWakeupId: v.optional(v.id("_scheduled_functions")),
    drainDueAt: v.optional(v.number()),
    drainToken: v.optional(v.string()),
    drainGeneration: v.optional(v.number()),
    activationTime: nullableNumber,
    activationSlot: nullableNumber,
    lastWebhookAt: nullableNumber,
    lastReconciledAt: nullableNumber,
    lastProcessedAt: nullableNumber,
    activationEvidence: nullableString,
  }).index("by_key", ["key"]),
  jupiterPrograms: defineTable({
    ...program.fields,
    source: v.string(),
    updatedAt: v.number(),
  }).index("by_programId", ["programId"]),
  chainTransactions: defineTable({
    signature: v.string(),
    status,
    source: v.union(
      v.literal("WEBHOOK"),
      v.literal("RECONCILIATION"),
      v.literal("REPROCESS"),
    ),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    firstSeenAt: v.number(),
    lease: nullableString,
    leaseUntil: nullableNumber,
    leaseWakeupId: v.optional(v.id("_scheduled_functions")),
    error: nullableString,
    parserVersion: v.number(),
    rawStorageId: v.union(v.id("_storage"), v.null()),
    arbitrages: v.optional(v.array(arbitrage)),
    movementAccounting: v.optional(movementAccounting),
    normalizerVersion: v.optional(v.number()),
    classifierVersion: v.optional(v.number()),
  })
    .index("by_signature", ["signature"])
    .index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"])
    .index("by_status_and_firstSeenAt", ["status", "firstSeenAt"]),
  pythTrades: defineTable(tradeFields)
    .index("by_tradeId", ["tradeId"])
    .index("by_signature", ["signature"])
    .index("by_blockTime", ["blockTime"])
    .index("by_side_and_blockTime", ["side", "blockTime"])
    .index("by_product_and_blockTime", ["product", "blockTime"])
    .index("by_side_and_product_and_blockTime", [
      "side",
      "product",
      "blockTime",
    ])
    .index("by_owner_and_blockTime", ["owner", "blockTime"]),
  jupiterOrders: defineTable(order.fields).index("by_orderKey", ["orderKey"]),
  executionOrderLinks: defineTable({
    tradeId: v.string(),
    orderKey: v.string(),
    owner: v.string(),
    confidence,
  }).index("by_tradeId", ["tradeId"]),
  tradeBuckets: defineTable({
    bucketStart: v.number(),
    product,
    ...totalsFields,
  })
    .index("by_bucketStart", ["bucketStart"])
    .index("by_bucketStart_and_product", ["bucketStart", "product"]),
  tradeOwnerBuckets: defineTable({
    bucketStart: v.number(),
    owner: v.string(),
    ...totalsFields,
  })
    .index("by_bucketStart", ["bucketStart"])
    .index("by_owner_and_bucketStart", ["owner", "bucketStart"]),
};
