import { analyzeRawEvidence } from "../lib/tracker/state-analysis";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { PARSER_VERSION } from "../lib/tracker/config";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { HeliusClient, ProviderError } from "./heliusClient";
import { decodeHelius, record } from "../lib/tracker/helius-format";
import { completeEvidence, parseTransaction } from "../lib/tracker/parsers";
import { getDefiLlamaHistoricalPriceUrl } from "../lib/market-prices";
import { applyHistoricalValuation } from "../lib/tracker/valuation";
import type { Trade, ParseResult } from "../lib/tracker/types";
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
export const drain = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const config = await ctx.runQuery(internal.trackerStore.configuration, {});
    if (!config.enabled) return null;
    const jobs = await ctx.runMutation(internal.trackerStore.claim, {});
    const client = new HeliusClient();
    for (const job of jobs) {
      try {
        const evidence = job.replayStorageId
          ? await ctx.storage.get(job.replayStorageId)
          : null;
        const cached = evidence
          ? record(JSON.parse(await evidence.text()))
          : null;
        const success =
          typeof cached?.finalizedSuccess === "boolean"
            ? cached.finalizedSuccess
            : await client.finalized(job.signature);
        // A cached raw transaction remains authoritative. On replay, refresh
        // only the optional decode after Helius has had time to index it.
        let payload = cached?.payload ?? (await client.evidence(job.signature));
        if (cached?.payload && record(cached.payload).parserStatus !== "OK") {
          try {
            const parsed = record(await client.parsed(job.signature));
            const rawTransaction = record(cached.payload).rawTransaction;
            if (
              parsed.signature === job.signature &&
              parsed.parserStatus === "OK" &&
              rawTransaction
            )
              payload = { ...parsed, rawTransaction };
          } catch {
            // Keep the retained raw evidence if enhanced decoding is still unavailable.
          }
        }
        const stateAnalysis = analyzeRawEvidence(
          payload,
          job.signature,
          success,
        );
        let result: ParseResult;
        try {
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
              for (const signature of history
                .filter((r) => r.err === null)
                .slice(0, 5)
                .map((r) => r.signature)) {
                const historical = parseTransaction(
                  decodeHelius(await client.parsed(signature)),
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
    if (jobs.length === 5)
      await ctx.scheduler.runAfter(1000, internal.trackerActions.drain, {});
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
