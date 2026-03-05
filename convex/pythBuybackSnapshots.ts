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

export const upsertBuybackState = internalMutation({
  args: {
    key: v.string(),
    latestProcessedSignature: v.optional(v.string()),
    totalUsdcSpent: v.number(),
    totalPythBought: v.number(),
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
          const totalUsdcSpent = state?.totalUsdcSpent ?? 0;
          const totalPythBought = state?.totalPythBought ?? 0;
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

        const totalUsdcSpent =
          (state?.totalUsdcSpent ?? 0) + Math.max(0, deltaUsdcSpent);
        const totalPythBought =
          (state?.totalPythBought ?? 0) + Math.max(0, deltaPythBought);
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
