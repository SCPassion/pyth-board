import { analyzeRawEvidence } from "../lib/tracker/state-analysis";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { PARSER_VERSION } from "../lib/tracker/config";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { HeliusClient, PARSED_BATCH_SIZE, PARSED_COALESCE_MS, ProviderError } from "./heliusClient";
import { decodeHelius, record } from "../lib/tracker/helius-format";
import { completeEvidence, parseTransaction } from "../lib/tracker/parsers";
import { rawDirectVenueTrade } from "../lib/tracker/venues/raw-direct";
import { getDefiLlamaHistoricalPriceUrl } from "../lib/market-prices";
import { applyHistoricalValuation } from "../lib/tracker/valuation";
import type { Trade, ParseResult } from "../lib/tracker/types";
import type { StateAnalysis } from "../lib/tracker/state-analysis";
async function valueTrades(trades: Trade[]): Promise<Trade[]> {
  if (!trades.length) return trades;
  try {
    const time = trades[0].blockTime / 1000;
    const r = await fetch(getDefiLlamaHistoricalPriceUrl(time), {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return trades;
    return applyHistoricalValuation(trades, await r.json());
  } catch {
    return trades;
  }
}
/** Bound paid isolation of malformed responses; unresolved signatures stay in review. */
async function loadParsed(
  client: HeliusClient,
  signatures: string[],
  budget = { remaining: 8 },
): Promise<Map<string, unknown>> {
  if (!budget.remaining) return new Map();
  budget.remaining--;
  try {
    return await client.parsedMany(signatures);
  } catch (e) {
    if (e instanceof ProviderError && e.transient) throw e;
    if (signatures.length === 1) return new Map();
    const middle = Math.floor(signatures.length / 2);
    const left = await loadParsed(client, signatures.slice(0, middle), budget);
    const right = await loadParsed(client, signatures.slice(middle), budget);
    return new Map([...left, ...right]);
  }
}
export const drain = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const config = await ctx.runQuery(internal.trackerStore.configuration, {});
    if (!config.enabled) return null;
    const jobs = await ctx.runMutation(internal.trackerStore.claim, {});
    const client = new HeliusClient();
    const ready: {
      job: (typeof jobs)[number];
      cached: Record<string, unknown> | null;
      success: boolean;
      rawTransaction: unknown;
      stateAnalysis: StateAnalysis;
      shortcut: Trade | null;
    }[] = [];
    for (const job of jobs) {
      try {
        const evidence = job.replayStorageId
          ? await ctx.storage.get(job.replayStorageId)
          : null;
        const cached = evidence
          ? record(JSON.parse(await evidence.text()))
          : null;
        const rawTransaction = cached?.payload
          ? record(cached.payload).rawTransaction
          : await client.rawEvidence(job.signature);
        const success = typeof cached?.finalizedSuccess === "boolean"
          ? cached.finalizedSuccess
          : client.succeeded(rawTransaction);
        const stateAnalysis = analyzeRawEvidence(
          { signature: job.signature, rawTransaction }, job.signature, success,
        );
        const shortcut = (!cached?.payload || record(cached.payload).parserStatus === "RAW_VERIFIED")
          ? rawDirectVenueTrade(rawTransaction, stateAnalysis, config.programs)
          : null;
        ready.push({ job, cached, success, rawTransaction, stateAnalysis, shortcut });
      } catch (e) {
        await ctx.runMutation(internal.trackerStore.fail, {
          id: job.id,
          lease: job.lease,
          reason: e instanceof ProviderError ? e.message : "Processing failed; inspect retained signature",
          transient: e instanceof ProviderError && e.transient,
        });
      }
    }
    const toDecode = ready.filter(({ cached, shortcut }) =>
      !shortcut && (!cached?.payload || record(cached.payload).parserStatus !== "OK"),
    );
    const decoded = new Map<string, unknown>();
    if (toDecode.length) {
      try {
        for (const [signature, value] of await loadParsed(client, toDecode.map(({ job }) => job.signature)))
          decoded.set(signature, value);
      } catch {
        // Retain raw evidence and schedule provider-decode review without a
        // paid per-signature fanout during a temporary outage.
      }
    }
    for (const { job, cached, success, rawTransaction, stateAnalysis, shortcut } of ready) {
      try {
        // A cached raw transaction remains authoritative on replay.
        const parsed = decoded.get(job.signature);
        let payload = cached?.payload ?? (shortcut
          ? { signature: job.signature, rawTransaction, parserStatus: "RAW_VERIFIED" }
          : client.combineEvidence(job.signature, rawTransaction, parsed));
        if (cached?.payload && record(cached.payload).parserStatus !== "OK" &&
            record(parsed).parserStatus === "OK" && rawTransaction)
          payload = client.combineEvidence(job.signature, rawTransaction, parsed);
        let result: ParseResult = shortcut
          ? { trades: [shortcut], orders: [], review: [] }
          : { trades: [], orders: [], review: [] };
        if (!shortcut) try {
          const tx = decodeHelius(payload);
          if (tx.signature !== job.signature)
            throw new Error("Provider returned a different signature");
          if (!success) tx.success = false;
          const keys = tx.instructions
            .flatMap((ix) =>
              config.programs
                .filter((p) => p.programId === ix.programId && p.orderRole)
                .flatMap((p) =>
                  ix.accounts[p.orderRole!] ? [ix.accounts[p.orderRole!]] : [],
                ),
            )
            .slice(0, 32);
          const known = await ctx.runQuery(internal.trackerStore.orders, {
            keys,
          });
          result = parseTransaction(tx, config.programs, known);
          // Recover creation/owner evidence even when an order predates activation.
          // Never import historical trades as part of attribution recovery.
          const missing = [
            ...new Set(
              result.trades
                .filter((t) => t.orderKey && !t.owner)
                .map((t) => t.orderKey!),
            ),
          ].slice(0, 2);
          for (const key of missing) {
            try {
              const history = await client.history(key, null);
              const signatures = history
                .filter((r) => r.err === null)
                .slice(0, 5)
                .map((r) => r.signature);
              let historicalBatch: Map<string, unknown> | null = null;
              if (signatures.length > 1) {
                try { historicalBatch = await client.parsedMany(signatures, "ATTRIBUTION"); }
                catch { /* Fall back to the original per-signature lookup. */ }
              }
              for (const signature of signatures) {
                const historical = parseTransaction(
                  decodeHelius(historicalBatch?.get(signature) ?? await client.parsed(signature, "ATTRIBUTION")),
                  config.programs,
                  known,
                );
                for (const link of historical.orders)
                  if (
                    link.orderKey === key &&
                    !known.some((o) => o.orderKey === key)
                  )
                    known.push(link);
                if (known.some((o) => o.orderKey === key)) break;
              }
            } catch {
              /* Valid volume survives attribution-provider failures. */
            }
          }
          if (missing.length) {
            result = parseTransaction(tx, config.programs, known);
            result.orders.push(
              ...known.filter((o) => missing.includes(o.orderKey)),
            );
          }
        } catch (e) {
          result = {
            trades: [],
            orders: [],
            review: [e instanceof Error ? e.message : "Decode failed"],
          };
        }
        result = completeEvidence(result, stateAnalysis);
        const rawStorageId = await ctx.storage.store(
          new Blob(
            [
              JSON.stringify({
                ...cached,
                payload,
                finalizedSuccess: success,
                stateAnalysis,
              }),
            ],
            {
              type: "application/json",
            },
          ),
        );
        await ctx.runMutation(internal.trackerStore.finish, {
          id: job.id,
          lease: job.lease,
          trades: await valueTrades(result.trades),
          orders: result.orders,
          review: result.review,
          arbitrages: result.arbitrages,
          movementAccounting: stateAnalysis.movementAccounting,
          normalizerVersion: stateAnalysis.normalized.normalizerVersion,
          classifierVersion: stateAnalysis.economic.classifierVersion,
          rawStorageId,
          parserVersion: PARSER_VERSION,
        });
      } catch (e) {
        await ctx.runMutation(internal.trackerStore.fail, {
          id: job.id,
          lease: job.lease,
          reason:
            e instanceof ProviderError
              ? e.message
              : "Processing failed; inspect retained signature",
          transient: e instanceof ProviderError && e.transient,
        });
      }
    }
    if (jobs.length) {
      const pending = await ctx.runQuery(internal.trackerStore.pendingCount, {});
      if (pending)
        await ctx.runMutation(internal.trackerStore.ensureDrainScheduled, {
          delay: pending === PARSED_BATCH_SIZE ? 0 : PARSED_COALESCE_MS,
        });
    }
    if (jobs.length)
      console.info("PYTH tracker Helius requests", {
        jobs: jobs.length,
        replayJobs: jobs.filter((job) => job.replayStorageId).length,
        rawShortcutJobs: ready.filter((item) => item.shortcut).length,
        ...client.usage,
      });
    return null;
  },
});
// Compatibility no-ops for jobs scheduled by older deployments. No history reads.
export const reconcile = internalAction({
  args: {},
  returns: v.null(),
  handler: async () => null,
});
export const reconcileProgram = internalAction({
  args: { programId: v.string() },
  returns: v.null(),
  handler: async () => null,
});

/** Installs fixture-verified discovery defaults without enabling ingestion. */
export const prepare = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runMutation(internal.trackerStore.configure, {
      programs: DISCOVERED_PROGRAMS,
      source:
        "Mainnet fixtures in tests/fixtures/jupiter; Helius Parsed Events 2026-09-12; Jupiter published SDK constants",
    });
    return null;
  },
});
