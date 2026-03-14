import { Connection, PublicKey } from "@solana/web3.js";
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";

const PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS =
  "GAdn7TZhszf5KTfwNRx3A2nP6KCRFEWucZubgdEqbJA2";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";
const BUYBACK_STATE_KEY = "council_ops_usdc_pyth";
const JUPITER_RECURRING_API =
  "https://lite-api.jup.ag/recurring/v1/getRecurringOrders";

const RPC_ENDPOINTS = [
  "https://solana-mainnet.g.alchemy.com/v2/VAWGO1qOMcxkm0B9H0xUPzpNMzBnIvo8",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-api.projectserum.com",
];

const CONNECTION_CONFIG = {
  commitment: "confirmed" as const,
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
  httpHeaders: {
    "User-Agent": "PythBoard/1.0",
  },
};

type JupiterRecurringOrder = {
  orderKey: string;
  inputMint: string;
  outputMint: string;
  inUsed: number;
  outReceived: number;
};

type JupiterRecurringResponse = {
  time?: JupiterRecurringOrder[];
  hasMoreData?: boolean;
};

function computeWeightedAverage(totalUsdcSpent: number, totalPythBought: number) {
  if (totalPythBought <= 0) {
    return 0;
  }
  return totalUsdcSpent / totalPythBought;
}

function getTokenTotalForOwner(
  balances:
    | Array<{
        mint: string;
        owner?: string;
        uiTokenAmount: { uiAmount?: number | null };
      }>
    | undefined,
  ownerAddress: string,
  mint: string
): number {
  if (!balances) {
    return 0;
  }

  let total = 0;
  for (const balance of balances) {
    if (balance.owner !== ownerAddress || balance.mint !== mint) {
      continue;
    }
    total += balance.uiTokenAmount.uiAmount ?? 0;
  }

  return total;
}

function getSwapDeltasForCouncilOps(
  tx: Awaited<ReturnType<Connection["getParsedTransaction"]>>,
  ownerAddress: string
): { usdcSpent: number; pythReceived: number } {
  if (!tx?.meta) {
    return { usdcSpent: 0, pythReceived: 0 };
  }

  if (tx.meta.err) {
    return { usdcSpent: 0, pythReceived: 0 };
  }

  const preUsdc = getTokenTotalForOwner(
    tx.meta.preTokenBalances as
      | Array<{
          mint: string;
          owner?: string;
          uiTokenAmount: { uiAmount?: number | null };
        }>
      | undefined,
    ownerAddress,
    USDC_MINT
  );
  const postUsdc = getTokenTotalForOwner(
    tx.meta.postTokenBalances as
      | Array<{
          mint: string;
          owner?: string;
          uiTokenAmount: { uiAmount?: number | null };
        }>
      | undefined,
    ownerAddress,
    USDC_MINT
  );
  const prePyth = getTokenTotalForOwner(
    tx.meta.preTokenBalances as
      | Array<{
          mint: string;
          owner?: string;
          uiTokenAmount: { uiAmount?: number | null };
        }>
      | undefined,
    ownerAddress,
    PYTH_MINT
  );
  const postPyth = getTokenTotalForOwner(
    tx.meta.postTokenBalances as
      | Array<{
          mint: string;
          owner?: string;
          uiTokenAmount: { uiAmount?: number | null };
        }>
      | undefined,
    ownerAddress,
    PYTH_MINT
  );

  const usdcSpent = Math.max(0, preUsdc - postUsdc);
  const pythReceived = Math.max(0, postPyth - prePyth);

  if (usdcSpent <= 0 || pythReceived <= 0) {
    return { usdcSpent: 0, pythReceived: 0 };
  }

  return { usdcSpent, pythReceived };
}

async function fetchNewSignaturesSinceCursor(
  connection: Connection,
  owner: PublicKey,
  latestProcessedSignature?: string
): Promise<string[]> {
  const signatures: string[] = [];
  let before: string | undefined;
  const MAX_SIGNATURES_PER_RUN = 300;

  while (true) {
    if (signatures.length >= MAX_SIGNATURES_PER_RUN) {
      break;
    }

    const page = await connection.getSignaturesForAddress(owner, {
      limit: 100,
      before,
      until: latestProcessedSignature,
    });

    if (page.length === 0) {
      break;
    }

    signatures.push(...page.map((entry) => entry.signature));

    if (page.length < 100) {
      break;
    }

    before = page[page.length - 1].signature;
  }

  return signatures;
}

async function fetchLatestSignature(
  connection: Connection,
  owner: PublicKey
): Promise<string | undefined> {
  const page = await connection.getSignaturesForAddress(owner, {
    limit: 1,
  });
  return page[0]?.signature;
}

async function fetchBackfillBatch(
  connection: Connection,
  owner: PublicKey,
  beforeSignature?: string
): Promise<string[]> {
  const page = await connection.getSignaturesForAddress(owner, {
    limit: 150,
    before: beforeSignature,
  });
  return page.map((entry) => entry.signature);
}

async function fetchJupiterRecurringOrders(
  orderStatus: "active" | "history"
): Promise<JupiterRecurringOrder[]> {
  const orders: JupiterRecurringOrder[] = [];
  let page = 1;

  while (true) {
    const url = new URL(JUPITER_RECURRING_API);
    url.searchParams.set("user", PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS);
    url.searchParams.set("recurringType", "time");
    url.searchParams.set("includeFailedTx", "false");
    url.searchParams.set("orderStatus", orderStatus);
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "PythBoard/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Jupiter recurring API failed (${orderStatus} page ${page}): ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as JupiterRecurringResponse;
    const timeOrders = data.time ?? [];
    orders.push(...timeOrders);

    if (!data.hasMoreData || timeOrders.length === 0) {
      break;
    }

    page += 1;
  }

  return orders;
}

async function fetchDcaBuybackTotals(): Promise<{
  totalUsdcSpentDca: number;
  totalPythBoughtDca: number;
}> {
  const [activeOrders, historyOrders] = await Promise.all([
    fetchJupiterRecurringOrders("active"),
    fetchJupiterRecurringOrders("history"),
  ]);

  const orderTotals = new Map<
    string,
    { totalUsdcSpentDca: number; totalPythBoughtDca: number }
  >();

  for (const order of [...activeOrders, ...historyOrders]) {
    if (order.inputMint !== USDC_MINT || order.outputMint !== PYTH_MINT) {
      continue;
    }

    orderTotals.set(order.orderKey, {
      totalUsdcSpentDca: Math.max(0, order.inUsed ?? 0),
      totalPythBoughtDca: Math.max(0, order.outReceived ?? 0),
    });
  }

  let totalUsdcSpentDca = 0;
  let totalPythBoughtDca = 0;

  for (const totals of orderTotals.values()) {
    totalUsdcSpentDca += totals.totalUsdcSpentDca;
    totalPythBoughtDca += totals.totalPythBoughtDca;
  }

  return {
    totalUsdcSpentDca,
    totalPythBoughtDca,
  };
}

export const upsertBuybackState = internalMutation({
  args: {
    key: v.string(),
    latestProcessedSignature: v.optional(v.string()),
    totalUsdcSpent: v.number(),
    totalPythBought: v.number(),
    totalUsdcSpentDirect: v.optional(v.number()),
    totalPythBoughtDirect: v.optional(v.number()),
    totalUsdcSpentDca: v.optional(v.number()),
    totalPythBoughtDca: v.optional(v.number()),
    backfillCursor: v.optional(v.string()),
    backfillComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pythBuybackState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        latestProcessedSignature: args.latestProcessedSignature,
        totalUsdcSpent: args.totalUsdcSpent,
        totalPythBought: args.totalPythBought,
        totalUsdcSpentDirect: args.totalUsdcSpentDirect,
        totalPythBoughtDirect: args.totalPythBoughtDirect,
        totalUsdcSpentDca: args.totalUsdcSpentDca,
        totalPythBoughtDca: args.totalPythBoughtDca,
        backfillCursor: args.backfillCursor,
        backfillComplete: args.backfillComplete,
      });
      return existing._id;
    }

    return await ctx.db.insert("pythBuybackState", args);
  },
});

export const insertBuybackSnapshot = internalMutation({
  args: {
    timestampMs: v.number(),
    minuteBucketMs: v.number(),
    totalUsdcSpent: v.number(),
    totalPythBought: v.number(),
    avgBuyPriceUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pythBuybackSnapshots")
      .withIndex("by_minuteBucketMs", (q) =>
        q.eq("minuteBucketMs", args.minuteBucketMs)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        timestampMs: args.timestampMs,
        totalUsdcSpent: args.totalUsdcSpent,
        totalPythBought: args.totalPythBought,
        avgBuyPriceUsd: args.avgBuyPriceUsd,
      });
      return existing._id;
    }

    return await ctx.db.insert("pythBuybackSnapshots", args);
  },
});

export const runPythBuybackSnapshotJob = internalAction({
  args: {},
  handler: async (ctx) => {
    const owner = new PublicKey(PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS);

    let lastError: unknown = null;
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const connection = new Connection(endpoint, CONNECTION_CONFIG);

        const state = await ctx.runQuery(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "pythBuybackSnapshots:getBuybackState" as any,
          { key: BUYBACK_STATE_KEY }
        );

        // Start-now behavior: initialize cursor to latest signature and avoid
        // historical backfill scans on first run.
        if (!state?.latestProcessedSignature) {
          const latestSignature = await fetchLatestSignature(connection, owner);
          let totalUsdcSpentDca = state?.totalUsdcSpentDca ?? 0;
          let totalPythBoughtDca = state?.totalPythBoughtDca ?? 0;

          try {
            const dcaTotals = await fetchDcaBuybackTotals();
            totalUsdcSpentDca = dcaTotals.totalUsdcSpentDca;
            totalPythBoughtDca = dcaTotals.totalPythBoughtDca;
          } catch (error) {
            console.warn("Failed to initialize DCA buyback totals:", error);
          }

          const totalUsdcSpentDirect = state?.totalUsdcSpentDirect ?? 0;
          const totalPythBoughtDirect = state?.totalPythBoughtDirect ?? 0;
          const totalUsdcSpent = totalUsdcSpentDirect + totalUsdcSpentDca;
          const totalPythBought = totalPythBoughtDirect + totalPythBoughtDca;
          const avgBuyPriceUsd = computeWeightedAverage(
            totalUsdcSpent,
            totalPythBought
          );
          const timestampMs = Date.now();
          const minuteBucketMs = Math.floor(timestampMs / 60_000) * 60_000;

          await ctx.runMutation(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "pythBuybackSnapshots:upsertBuybackState" as any,
            {
              key: BUYBACK_STATE_KEY,
              latestProcessedSignature: latestSignature,
              totalUsdcSpent,
              totalPythBought,
              totalUsdcSpentDirect,
              totalPythBoughtDirect,
              totalUsdcSpentDca,
              totalPythBoughtDca,
            }
          );

          await ctx.runMutation(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "pythBuybackSnapshots:insertBuybackSnapshot" as any,
            {
              timestampMs,
              minuteBucketMs,
              totalUsdcSpent,
              totalPythBought,
              avgBuyPriceUsd,
            }
          );

          return {
            endpoint,
            initialized: true,
            processedSignatures: 0,
            deltaUsdcSpent: 0,
            deltaPythBought: 0,
            totalUsdcSpent,
            totalPythBought,
            avgBuyPriceUsd,
            timestampMs,
          };
        }

        // Step 1: Backfill batch (runs until wallet beginning is reached)
        let backfillDeltaUsdcSpent = 0;
        let backfillDeltaPythBought = 0;
        let newBackfillCursor: string | undefined = state?.backfillCursor;
        let newBackfillComplete: boolean = state?.backfillComplete ?? false;

        if (!newBackfillComplete) {
          try {
            // state.latestProcessedSignature is guaranteed set in this branch (init guard above)
            const backfillStartCursor =
              newBackfillCursor ?? state?.latestProcessedSignature;
            const backfillSigs = await fetchBackfillBatch(
              connection,
              owner,
              backfillStartCursor
            );

            if (backfillSigs.length === 0) {
              // Reached the wallet's beginning
              newBackfillComplete = true;
            } else {
              const parsedBackfillTxs = await connection.getParsedTransactions(
                backfillSigs,
                { maxSupportedTransactionVersion: 0 }
              );
              for (const tx of parsedBackfillTxs) {
                const deltas = getSwapDeltasForCouncilOps(
                  tx,
                  PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS
                );
                backfillDeltaUsdcSpent += deltas.usdcSpent;
                backfillDeltaPythBought += deltas.pythReceived;
              }
              // Advance cursor to oldest sig in this batch
              newBackfillCursor = backfillSigs[backfillSigs.length - 1];
            }
          } catch (error) {
            // Backfill failure is non-fatal: cursor unchanged, retries next hour
            console.warn("Backfill batch failed, will retry next run:", error);
          }
        }

        const newSignatures = await fetchNewSignaturesSinceCursor(
          connection,
          owner,
          state?.latestProcessedSignature
        );

        let deltaUsdcSpent = 0;
        let deltaPythBought = 0;

        if (newSignatures.length > 0) {
          const parsedTransactions = await connection.getParsedTransactions(
            newSignatures,
            { maxSupportedTransactionVersion: 0 }
          );

          for (const tx of parsedTransactions) {
            const deltas = getSwapDeltasForCouncilOps(
              tx,
              PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS
            );
            deltaUsdcSpent += deltas.usdcSpent;
            deltaPythBought += deltas.pythReceived;
          }
        }

        const totalUsdcSpentDirect =
          (state?.totalUsdcSpentDirect ?? 0) +
          Math.max(0, deltaUsdcSpent) +
          Math.max(0, backfillDeltaUsdcSpent);
        const totalPythBoughtDirect =
          (state?.totalPythBoughtDirect ?? 0) +
          Math.max(0, deltaPythBought) +
          Math.max(0, backfillDeltaPythBought);

        let totalUsdcSpentDca = state?.totalUsdcSpentDca ?? 0;
        let totalPythBoughtDca = state?.totalPythBoughtDca ?? 0;

        try {
          const dcaTotals = await fetchDcaBuybackTotals();
          totalUsdcSpentDca = dcaTotals.totalUsdcSpentDca;
          totalPythBoughtDca = dcaTotals.totalPythBoughtDca;
        } catch (error) {
          console.warn("Failed to refresh DCA buyback totals:", error);
        }

        const totalUsdcSpent = totalUsdcSpentDirect + totalUsdcSpentDca;
        const totalPythBought = totalPythBoughtDirect + totalPythBoughtDca;
        const avgBuyPriceUsd = computeWeightedAverage(
          totalUsdcSpent,
          totalPythBought
        );

        const timestampMs = Date.now();
        const minuteBucketMs = Math.floor(timestampMs / 60_000) * 60_000;
        const latestProcessedSignature =
          newSignatures.length > 0
            ? newSignatures[0]
            : state?.latestProcessedSignature;

        await ctx.runMutation(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "pythBuybackSnapshots:upsertBuybackState" as any,
          {
            key: BUYBACK_STATE_KEY,
            latestProcessedSignature,
            totalUsdcSpent,
            totalPythBought,
            totalUsdcSpentDirect,
            totalPythBoughtDirect,
            totalUsdcSpentDca,
            totalPythBoughtDca,
            backfillCursor: newBackfillCursor,
            backfillComplete: newBackfillComplete,
          }
        );

        await ctx.runMutation(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "pythBuybackSnapshots:insertBuybackSnapshot" as any,
          {
            timestampMs,
            minuteBucketMs,
            totalUsdcSpent,
            totalPythBought,
            avgBuyPriceUsd,
          }
        );

        return {
          endpoint,
          processedSignatures: newSignatures.length,
          deltaUsdcSpent,
          deltaPythBought,
          backfillDeltaUsdcSpent,
          backfillDeltaPythBought,
          backfillComplete: newBackfillComplete,
          totalUsdcSpent,
          totalPythBought,
          avgBuyPriceUsd,
          timestampMs,
        };
      } catch (error) {
        lastError = error;
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : "Unknown error";
    throw new Error(`Failed to run PYTH buyback snapshot job: ${errorMessage}`);
  },
});

export const getBuybackState = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pythBuybackState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

export const getPythBuybackSummary = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db
      .query("pythBuybackState")
      .withIndex("by_key", (q) => q.eq("key", BUYBACK_STATE_KEY))
      .first();

    const firstSnapshot = await ctx.db
      .query("pythBuybackSnapshots")
      .withIndex("by_timestampMs", (q) => q.gte("timestampMs", 0))
      .order("asc")
      .first();

    const latestSnapshot = await ctx.db
      .query("pythBuybackSnapshots")
      .withIndex("by_timestampMs", (q) => q.gte("timestampMs", 0))
      .order("desc")
      .first();

    return {
      totalUsdcSpent: state?.totalUsdcSpent ?? 0,
      totalPythBought: state?.totalPythBought ?? 0,
      avgBuyPriceUsd:
        latestSnapshot?.avgBuyPriceUsd ??
        computeWeightedAverage(state?.totalUsdcSpent ?? 0, state?.totalPythBought ?? 0),
      latestProcessedSignature: state?.latestProcessedSignature ?? null,
      lastUpdatedMs: latestSnapshot?.timestampMs ?? null,
      trackingStartedMs: firstSnapshot?.timestampMs ?? null,
      backfillComplete: state?.backfillComplete ?? false,
    };
  },
});

export const getPythBuybackHistory = query({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.db
      .query("pythBuybackSnapshots")
      .withIndex("by_timestampMs", (q) => q.gte("timestampMs", 0))
      .order("asc")
      .collect();

    return snapshots.map((snapshot) => ({
      id: snapshot._id,
      timestampMs: snapshot.timestampMs,
      minuteBucketMs: snapshot.minuteBucketMs,
      totalUsdcSpent: snapshot.totalUsdcSpent,
      totalPythBought: snapshot.totalPythBought,
      avgBuyPriceUsd: snapshot.avgBuyPriceUsd,
    }));
  },
});

export const triggerPythBuybackSnapshot = mutation({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return await ctx.scheduler.runAfter(
      0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "pythBuybackSnapshots:runPythBuybackSnapshotJob" as any,
      {}
    );
  },
});
