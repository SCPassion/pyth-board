import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  program,
  trade,
  order,
  arbitrage,
  movementAccounting,
} from "./trackerModel";
import {
  addTotals,
  contribution,
  emptyTotals,
  eligibleOwner,
  bucketStart,
  retryDelay,
} from "../lib/tracker/analytics";
import { rawAmount } from "../lib/tracker/helius-format";
import { PARSER_VERSION } from "../lib/tracker/config";
import type { Trade } from "../lib/tracker/types";
async function metric(
  ctx: MutationCtx,
  delta: Partial<{
    candidates: number;
    processed: number;
    reviews: number;
    failures: number;
    retries: number;
    reconciliationDiscoveries: number;
  }>,
) {
  const hour = bucketStart(Date.now());
  const existing = await ctx.db
    .query("trackerMetrics")
    .withIndex("by_bucketStart", (q) => q.eq("bucketStart", hour))
    .unique();
  const counts = {
    candidates: existing?.candidates ?? 0,
    processed: existing?.processed ?? 0,
    reviews: existing?.reviews ?? 0,
    failures: existing?.failures ?? 0,
    retries: existing?.retries ?? 0,
    reconciliationDiscoveries: existing?.reconciliationDiscoveries ?? 0,
  };
  for (const key of Object.keys(delta) as (keyof typeof counts)[])
    counts[key] += delta[key] ?? 0;
  if (existing) await ctx.db.patch(existing._id, counts);
  else await ctx.db.insert("trackerMetrics", { bucketStart: hour, ...counts });
}
export const configuration = internalQuery({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    fullCoverage: v.boolean(),
    activationTime: v.union(v.number(), v.null()),
    programs: v.array(program),
  }),
  handler: async (ctx) => {
    const state = await ctx.db
      .query("trackerState")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    const programs = await ctx.db.query("jupiterPrograms").take(32);
    return {
      enabled: !!(state?.enabled || state?.webhookEnabled),
      fullCoverage: state?.enabled ?? false,
      activationTime: state?.activationTime ?? null,
      programs: programs.map(
        ({
          programId,
          product,
          instructionNames,
          ownerRole,
          orderRole,
          verified,
        }) => ({
          programId,
          product,
          instructionNames,
          ownerRole,
          orderRole,
          verified,
        }),
      ),
    };
  },
});
export const configure = internalMutation({
  args: { programs: v.array(program), source: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.programs.length > 16) throw new Error("At most 16 programs");
    const state = await ctx.db
      .query("trackerState")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (state?.enabled)
      throw new Error("Disable collection before changing registry");
    const previous = await ctx.db.query("jupiterPrograms").take(33);
    for (const p of previous)
      if (!args.programs.some((next) => next.programId === p.programId))
        await ctx.db.delete(p._id);
    for (const p of args.programs) {
      const existing = await ctx.db
        .query("jupiterPrograms")
        .withIndex("by_programId", (q) => q.eq("programId", p.programId))
        .unique();
      const row = { ...p, source: args.source, updatedAt: Date.now() };
      if (existing) await ctx.db.replace(existing._id, row);
      else await ctx.db.insert("jupiterPrograms", row);
    }
    return null;
  },
});
export const setEnabled = internalMutation({
  args: {
    enabled: v.boolean(),
    activationSlot: v.optional(v.number()),
    evidence: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("trackerState")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (args.enabled) {
      const programs = await ctx.db.query("jupiterPrograms").take(32);
      if (
        !["SWAP", "RECURRING", "TRIGGER"].every((product) =>
          programs.some((p) => p.product === product && p.verified),
        )
      )
        throw new Error("All product fixture gates must pass");
      if (!args.evidence?.trim() || !process.env.HELIUS_API_KEY)
        throw new Error("Helius API key and coverage evidence required");
      if (
        !state?.activationTime &&
        (!Number.isSafeInteger(args.activationSlot) ||
          (args.activationSlot ?? 0) < 1)
      )
        throw new Error("Finalized activation slot required");
    }
    const value = {
      key: "main",
      enabled: args.enabled,
      activationTime:
        state?.activationTime ?? (args.enabled ? Date.now() : null),
      activationSlot: state?.activationSlot ?? args.activationSlot ?? null,
      lastWebhookAt: state?.lastWebhookAt ?? null,
      lastReconciledAt: state?.lastReconciledAt ?? null,
      lastProcessedAt: state?.lastProcessedAt ?? null,
      activationEvidence: args.evidence ?? state?.activationEvidence ?? null,
    };
    if (state) await ctx.db.replace(state._id, value);
    else await ctx.db.insert("trackerState", value);
    return null;
  },
});
export const enqueue = internalMutation({
  args: {
    signatures: v.array(v.string()),
    source: v.union(v.literal("WEBHOOK"), v.literal("RECONCILIATION")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("trackerState")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (!state?.enabled && !state?.webhookEnabled) return 0;
    if (args.signatures.length > 100) throw new Error("Batch too large");
    let added = 0;
    for (const signature of new Set(args.signatures)) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature))
        throw new Error("Invalid signature");
      const exists = await ctx.db
        .query("chainTransactions")
        .withIndex("by_signature", (q) => q.eq("signature", signature))
        .unique();
      if (!exists) {
        await ctx.db.insert("chainTransactions", {
          signature,
          status: "DISCOVERED",
          source: args.source,
          attempts: 0,
          nextAttemptAt: Date.now(),
          firstSeenAt: Date.now(),
          lease: null,
          leaseUntil: null,
          error: null,
          parserVersion: PARSER_VERSION,
          rawStorageId: null,
        });
        added++;
      }
    }
    if (added)
      await metric(ctx, {
        candidates: added,
        reconciliationDiscoveries: args.source === "RECONCILIATION" ? added : 0,
      });
    if (args.source === "WEBHOOK")
      await ctx.db.patch(state._id, { lastWebhookAt: Date.now() });
    if (added)
      await ctx.scheduler.runAfter(0, internal.trackerActions.drain, {});
    return added;
  },
});
export const claim = internalMutation({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("chainTransactions"),
      signature: v.string(),
      lease: v.string(),
      replayStorageId: v.union(v.id("_storage"), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const state = await ctx.db
      .query("trackerState")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (!state?.enabled && !state?.webhookEnabled) return [];
    const result = [];
    let exhausted = 0;
    for (const status of ["FETCHING", "RETRY", "DISCOVERED"] as const) {
      const rows = await ctx.db
        .query("chainTransactions")
        .withIndex("by_status_and_nextAttemptAt", (q) =>
          q.eq("status", status).lte("nextAttemptAt", Date.now()),
        )
        .take(50);
      for (const row of rows) {
        if (row.attempts >= 8) {
          if (row.leaseWakeupId)
            await ctx.scheduler.cancel(row.leaseWakeupId);
          await ctx.db.patch(row._id, {
            status: "FAILED",
            error: "Attempt limit reached after lease expiry",
            lease: null,
            leaseUntil: null,
            leaseWakeupId: undefined,
          });
          exhausted++;
          continue;
        }
        const lease = `${row._id}:${row.attempts + 1}:${Date.now()}`;
        const leaseWakeupId = await ctx.scheduler.runAfter(
          600000,
          internal.trackerStore.wakeExpiredLease,
          { id: row._id, lease },
        );
        await ctx.db.patch(row._id, {
          leaseWakeupId,
          status: "FETCHING",
          attempts: row.attempts + 1,
          lease,
          leaseUntil: Date.now() + 600000,
          nextAttemptAt: Date.now() + 600000,
        });
        result.push({
          id: row._id,
          signature: row.signature,
          lease,
          replayStorageId: row.source === "REPROCESS" ? row.rawStorageId : null,
        });
        if (result.length === 5) break;
      }
      if (result.length === 5) break;
    }
    if (exhausted) await metric(ctx, { failures: exhausted });
    // More exhausted rows may be behind this bounded scan. Continue without
    // waiting for another webhook or leaving healthy work behind them.
    if (exhausted >= 50 && result.length < 5)
      await ctx.scheduler.runAfter(0, internal.trackerActions.drain, {});
    return result;
  },
});
async function adjust(ctx: MutationCtx, t: Trade, factor: number) {
  const start = bucketStart(t.blockTime),
    delta = contribution(t);
  const b = await ctx.db
    .query("tradeBuckets")
    .withIndex("by_bucketStart_and_product", (q) =>
      q.eq("bucketStart", start).eq("product", t.product),
    )
    .unique();
  const value = addTotals(b ?? emptyTotals(), delta, factor);
  if (b) await ctx.db.patch(b._id, value);
  else
    await ctx.db.insert("tradeBuckets", {
      bucketStart: start,
      product: t.product,
      ...value,
    });
  if (eligibleOwner(t)) {
    const owner = t.owner!;
    const ob = await ctx.db
      .query("tradeOwnerBuckets")
      .withIndex("by_owner_and_bucketStart", (q) =>
        q.eq("owner", owner).eq("bucketStart", start),
      )
      .unique();
    const ov = addTotals(ob ?? emptyTotals(), delta, factor);
    if (ob) await ctx.db.patch(ob._id, ov);
    else
      await ctx.db.insert("tradeOwnerBuckets", {
        bucketStart: start,
        owner,
        ...ov,
      });
  }
}
export const finish = internalMutation({
  args: {
    id: v.id("chainTransactions"),
    lease: v.string(),
    trades: v.array(trade),
    orders: v.array(order),
    review: v.array(v.string()),
    arbitrages: v.optional(v.array(arbitrage)),
    movementAccounting: v.optional(movementAccounting),
    normalizerVersion: v.optional(v.number()),
    classifierVersion: v.optional(v.number()),
    rawStorageId: v.id("_storage"),
    // Optional during rollout so already-running older actions can finish.
    parserVersion: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.lease !== args.lease) {
      if (row?.rawStorageId !== args.rawStorageId)
        await ctx.storage.delete(args.rawStorageId);
      return null;
    }
    if (row.leaseWakeupId) await ctx.scheduler.cancel(row.leaseWakeupId);
    for (const version of [args.normalizerVersion, args.classifierVersion])
      if (
        version !== undefined &&
        (!Number.isSafeInteger(version) || version < 1)
      )
        throw new Error("Invalid analysis version");
    const incomingArbitrages = args.arbitrages ?? [];
    if (args.trades.length + incomingArbitrages.length > 32)
      throw new Error("Execution count exceeds safe batch limit");
    // A deployment can change while an action is running. Record the worker's
    // version, never this mutation's version. Legacy empty results stay replayable.
    const parserVersion =
      args.parserVersion ??
      args.trades[0]?.parserVersion ??
      incomingArbitrages[0]?.parserVersion ??
      args.movementAccounting?.parserVersion ??
      0;
    if (
      !Number.isSafeInteger(parserVersion) ||
      parserVersion < 0 ||
      [...args.trades, ...incomingArbitrages].some(
        (t) => t.parserVersion !== parserVersion,
      )
    )
      throw new Error("Inconsistent parser version");
    const state = await ctx.db
      .query("trackerState")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    const movement = args.movementAccounting;
    if (movement) {
      if (
        movement.signature !== row.signature ||
        movement.parserVersion !== parserVersion ||
        !Number.isSafeInteger(movement.slot) ||
        movement.slot < 0 ||
        !Number.isSafeInteger(movement.blockTime) ||
        movement.blockTime < 0 ||
        movement.balances.length > 128 ||
        movement.transfers.length > 256 ||
        movement.issues.length > 130 ||
        movement.issues.some((i) => i.length > 200) ||
        new Set(movement.balances.map((b) => b.tokenAccount)).size !==
          movement.balances.length
      )
        throw new Error("Invalid movement identity, version or bounds");
      const net = new Map<string, bigint>();
      const positions = new Set<string>();
      for (const t of movement.transfers) {
        const position = `${t.instructionIndex}:${t.innerInstructionIndex}`;
        if (
          positions.has(position) ||
          !Number.isSafeInteger(t.instructionIndex) ||
          t.instructionIndex < 0 ||
          (t.innerInstructionIndex !== null &&
            (!Number.isSafeInteger(t.innerInstructionIndex) ||
              t.innerInstructionIndex < 0)) ||
          !movement.balances.some((b) => b.tokenAccount === t.source) ||
          !movement.balances.some((b) => b.tokenAccount === t.destination)
        )
          throw new Error("Invalid movement transfer");
        positions.add(position);
        const amount = BigInt(rawAmount(t.amountRaw));
        net.set(t.source, (net.get(t.source) ?? 0n) - amount);
        net.set(t.destination, (net.get(t.destination) ?? 0n) + amount);
      }
      for (const b of movement.balances) {
        const pre = b.preRaw === null ? null : BigInt(rawAmount(b.preRaw)),
          post = b.postRaw === null ? null : BigInt(rawAmount(b.postRaw));
        const delta = pre === null || post === null ? null : String(post - pre);
        if (
          b.deltaRaw !== delta ||
          (movement.status === "RECONCILED" &&
            (delta === null ||
              BigInt(delta) !== (net.get(b.tokenAccount) ?? 0n)))
        )
          throw new Error("Invalid movement balance");
      }
      if (
        (movement.status === "RECONCILED" &&
          (!movement.balances.length || movement.issues.length)) ||
        (movement.status === "UNAVAILABLE" &&
          (movement.balances.length || movement.transfers.length)) ||
        (movement.status !== "RECONCILED" && !movement.issues.length)
      )
        throw new Error("Invalid movement status");
    }
    const acceptedMovement =
      movement &&
      state?.activationTime &&
      movement.blockTime >= state.activationTime &&
      movement.slot >= (state.activationSlot ?? 0)
        ? movement
        : undefined;
    const executionIds = new Set(args.trades.map((t) => t.tradeId));
    for (const execution of incomingArbitrages) {
      if (
        execution.signature !== row.signature ||
        !execution.executionId.startsWith(row.signature + ":") ||
        executionIds.has(execution.executionId) ||
        execution.settlements.length !== 2 ||
        execution.routeLegs.length > 32 ||
        new Set(execution.settlements.map((s) => s.mint)).size !== 2
      )
        throw new Error("Invalid arbitrage identity or bounds");
      executionIds.add(execution.executionId);
      for (const s of execution.settlements) {
        const debit = BigInt(rawAmount(s.debitRaw)),
          credit = BigInt(rawAmount(s.creditRaw));
        if (
          debit <= 0n ||
          credit <= debit ||
          credit - debit !== BigInt(rawAmount(s.netRaw)) ||
          !Number.isInteger(s.decimals) ||
          s.decimals < 0 ||
          s.decimals > 18
        )
          throw new Error("Invalid arbitrage settlement");
      }
      const feeSettlement = execution.settlements.find(
        (s) => s.mint === execution.hostFee.mint,
      );
      if (
        !feeSettlement ||
        feeSettlement.tokenAccount !== execution.hostFee.tokenAccount ||
        rawAmount(execution.hostFee.amountRaw) !== feeSettlement.netRaw
      )
        throw new Error("Invalid arbitrage host fee");
    }
    const arbitrages = incomingArbitrages.filter(
      (t) =>
        state?.activationTime &&
        t.blockTime >= state.activationTime &&
        t.slot >= (state.activationSlot ?? 0),
    );
    if (args.review.length) {
      arbitrages.push(
        ...(row.arbitrages ?? []).filter(
          (old) => !executionIds.has(old.executionId),
        ),
      );
    }
    if (arbitrages.length > 32) throw new Error("Too many retained arbitrages");
    const old = await ctx.db
      .query("pythTrades")
      .withIndex("by_signature", (q) => q.eq("signature", row.signature))
      .take(33);
    for (const t of old) {
      if (args.review.length && !executionIds.has(t.tradeId)) continue;
      await adjust(ctx, t, -1);
      await ctx.db.delete(t._id);
      const links = await ctx.db
        .query("executionOrderLinks")
        .withIndex("by_tradeId", (q) => q.eq("tradeId", t.tradeId))
        .take(4);
      for (const l of links) await ctx.db.delete(l._id);
    }
    const ids = new Set<string>();
    for (const t of args.trades) {
      if (t.signature !== row.signature || ids.has(t.tradeId))
        throw new Error("Invalid execution identity");
      ids.add(t.tradeId);
      if (
        !state?.activationTime ||
        t.blockTime < state.activationTime ||
        t.slot < (state.activationSlot ?? 0)
      )
        continue;
      await ctx.db.insert("pythTrades", t);
      await adjust(ctx, t, 1);
      if (t.orderKey && eligibleOwner(t))
        await ctx.db.insert("executionOrderLinks", {
          tradeId: t.tradeId,
          orderKey: t.orderKey,
          owner: t.owner!,
          confidence: t.ownerConfidence,
        });
    }
    for (const o of args.orders) {
      const oldOrder = await ctx.db
        .query("jupiterOrders")
        .withIndex("by_orderKey", (q) => q.eq("orderKey", o.orderKey))
        .unique();
      if (oldOrder && oldOrder.owner !== o.owner)
        throw new Error("Conflicting order ownership");
      if (!oldOrder) await ctx.db.insert("jupiterOrders", o);
    }
    if (row.rawStorageId) await ctx.storage.delete(row.rawStorageId);
    await ctx.db.patch(row._id, {
      status: args.review.length
        ? "PARSE_REVIEW"
        : args.trades.length || arbitrages.length
          ? "STORED"
          : "IGNORED",
      error: args.review.length ? args.review.join("; ").slice(0, 2000) : null,
      rawStorageId: args.rawStorageId,
      normalizerVersion: args.normalizerVersion,
      classifierVersion: args.classifierVersion,
      arbitrages,
      movementAccounting:
        acceptedMovement?.status === "UNAVAILABLE" && row.movementAccounting
          ? row.movementAccounting
          : (acceptedMovement ?? row.movementAccounting),
      lease: null,
      leaseUntil: null,
      parserVersion,
    });
    await metric(ctx, { processed: 1, reviews: args.review.length ? 1 : 0 });
    if (state) await ctx.db.patch(state._id, { lastProcessedAt: Date.now() });
    return null;
  },
});
export const fail = internalMutation({
  args: {
    id: v.id("chainTransactions"),
    lease: v.string(),
    reason: v.string(),
    transient: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.lease !== args.lease) return null;
    if (row.leaseWakeupId) await ctx.scheduler.cancel(row.leaseWakeupId);
    if (args.transient && row.attempts < 8)
      await ctx.scheduler.runAfter(
        retryDelay(row.attempts),
        internal.trackerActions.drain,
        {},
      );
    await metric(
      ctx,
      args.transient && row.attempts < 8 ? { retries: 1 } : { failures: 1 },
    );
    await ctx.db.patch(row._id, {
      status: args.transient && row.attempts < 8 ? "RETRY" : "FAILED",
      nextAttemptAt: Date.now() + retryDelay(row.attempts),
      error: args.reason.slice(0, 1000),
      lease: null,
      leaseUntil: null,
    });
    return null;
  },
});
export const replay = internalMutation({
  args: { signature: v.string() },
  returns: v.null(),
  handler: async (ctx, { signature }) => {
    const row = await ctx.db
      .query("chainTransactions")
      .withIndex("by_signature", (q) => q.eq("signature", signature))
      .unique();
    if (!row) throw new Error("Unknown signature");
    if (row.leaseWakeupId) await ctx.scheduler.cancel(row.leaseWakeupId);
    await ctx.db.patch(row._id, {
      status: "RETRY",
      attempts: 0,
      nextAttemptAt: Date.now(),
      lease: null,
      leaseUntil: null,
      leaseWakeupId: undefined,
      source: "REPROCESS",
    });
    await ctx.scheduler.runAfter(0, internal.trackerActions.drain, {});
    return null;
  },
});
export const orders = internalQuery({
  args: { keys: v.array(v.string()) },
  returns: v.array(order),
  handler: async (ctx, { keys }) => {
    if (keys.length > 32) throw new Error("Too many orders");
    const result = [];
    for (const key of keys) {
      const o = await ctx.db
        .query("jupiterOrders")
        .withIndex("by_orderKey", (q) => q.eq("orderKey", key))
        .unique();
      if (o)
        result.push({
          orderKey: o.orderKey,
          owner: o.owner,
          product: o.product,
          programId: o.programId,
          sourceSignature: o.sourceSignature,
        });
    }
    return result;
  },
});
export const enableWebhooks = internalMutation({
  args: { evidence: v.string() },
  returns: v.null(),
  handler: async (ctx, { evidence }) => {
    if (!process.env.HELIUS_API_KEY) throw new Error("Helius API key required");
    if (!evidence.trim()) throw new Error("Partial-coverage release evidence required");
    const state = await ctx.db
      .query("trackerState")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (state?.enabled) throw new Error("Full collection is already enabled");
    const next = {
      key: "main",
      enabled: false,
      webhookEnabled: true,
      activationTime: state?.activationTime ?? Date.now(),
      activationSlot: state?.activationSlot ?? null,
      lastWebhookAt: state?.lastWebhookAt ?? null,
      lastReconciledAt: state?.lastReconciledAt ?? null,
      lastProcessedAt: state?.lastProcessedAt ?? null,
      activationEvidence: evidence,
    };
    if (state) await ctx.db.patch(state._id, next);
    else await ctx.db.insert("trackerState", next);
    await ctx.scheduler.runAfter(0, internal.trackerActions.drain, {});
    return null;
  },
});

/** Operator-driven replay of retained evidence after a parser upgrade. Bounded
 * pages, persistent Convex cursor, normal retry queue and aggregate correction. */
export const replayParserPage = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    queued: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("chainTransactions").paginate({
      ...args.paginationOpts,
      numItems: Math.min(50, Math.max(1, args.paginationOpts.numItems)),
    });
    let queued = 0;
    for (const row of page.page) {
      if (
        row.parserVersion >= PARSER_VERSION ||
        !row.rawStorageId ||
        row.status === "FETCHING"
      )
        continue;
      await ctx.db.patch(row._id, {
        status: "RETRY",
        source: "REPROCESS",
        attempts: 0,
        nextAttemptAt: Date.now(),
        lease: null,
        leaseUntil: null,
      });
      queued++;
    }
    if (queued)
      await ctx.scheduler.runAfter(0, internal.trackerActions.drain, {});
    return { queued, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** One-off recovery for a claimed transaction whose worker was interrupted.
 * Successful/failed attempts cancel this scheduled mutation. No idle polling. */
export const wakeExpiredLease = internalMutation({
  args: { id: v.id("chainTransactions"), lease: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (
      row?.status === "FETCHING" &&
      row.lease === args.lease &&
      (row.leaseUntil ?? Infinity) <= Date.now()
    )
      await ctx.scheduler.runAfter(0, internal.trackerActions.drain, {});
    return null;
  },
});
