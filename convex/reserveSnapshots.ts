import { Connection, PublicKey } from "@solana/web3.js";
import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";

const DAO_TREASURY_ADDRESS = "Gx4MBPb1vqZLJajZmsKLg8fGw9ErhoKsR8LeKcCKFyak";
const PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS =
  "GAdn7TZhszf5KTfwNRx3A2nP6KCRFEWucZubgdEqbJA2";
const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

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

async function getPythBalanceForAddress(
  connection: Connection,
  address: string
): Promise<number> {
  const owner = new PublicKey(address);
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  let total = 0;
  for (const account of tokenAccounts.value) {
    const parsedInfo = account.account.data.parsed?.info;
    const mint = parsedInfo?.mint;
    if (mint !== PYTH_MINT) {
      continue;
    }

    const amount = parsedInfo?.tokenAmount?.uiAmount;
    total += typeof amount === "number" ? amount : 0;
  }

  return total;
}

async function fetchTotalPythHeldFromChain(): Promise<number> {
  let lastError: unknown = null;

  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const connection = new Connection(endpoint, CONNECTION_CONFIG);
      const [daoTreasuryPyth, councilOpsPyth] = await Promise.all([
        getPythBalanceForAddress(connection, DAO_TREASURY_ADDRESS),
        getPythBalanceForAddress(connection, PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS),
      ]);
      return daoTreasuryPyth + councilOpsPyth;
    } catch (error) {
      lastError = error;
    }
  }

  const errorMessage =
    lastError instanceof Error ? lastError.message : "Unknown error";
  throw new Error(`Failed to fetch total PYTH held: ${errorMessage}`);
}

function getPythDeltaForOwnerFromParsedTx(
  tx: Awaited<ReturnType<Connection["getParsedTransaction"]>>,
  ownerAddress: string
): number {
  if (!tx?.meta) {
    return 0;
  }

  let preTotal = 0;
  for (const balance of tx.meta.preTokenBalances ?? []) {
    if (balance.mint !== PYTH_MINT || balance.owner !== ownerAddress) {
      continue;
    }
    preTotal += balance.uiTokenAmount.uiAmount ?? 0;
  }

  let postTotal = 0;
  for (const balance of tx.meta.postTokenBalances ?? []) {
    if (balance.mint !== PYTH_MINT || balance.owner !== ownerAddress) {
      continue;
    }
    postTotal += balance.uiTokenAmount.uiAmount ?? 0;
  }

  return postTotal - preTotal;
}

async function fetchPythDeltasForOwnerSince(
  connection: Connection,
  ownerAddress: string,
  startTimestampSec: number
): Promise<Array<{ timestampMs: number; delta: number }>> {
  const owner = new PublicKey(ownerAddress);
  const deltas: Array<{ timestampMs: number; delta: number }> = [];
  let before: string | undefined = undefined;

  while (true) {
    const signatures = await connection.getSignaturesForAddress(owner, {
      limit: 100,
      before,
    });

    if (signatures.length === 0) {
      break;
    }

    const relevant = signatures.filter(
      (signature) =>
        typeof signature.blockTime === "number" &&
        signature.blockTime >= startTimestampSec
    );

    if (relevant.length > 0) {
      const parsedTransactions = await connection.getParsedTransactions(
        relevant.map((signature) => signature.signature),
        { maxSupportedTransactionVersion: 0 }
      );

      for (let i = 0; i < relevant.length; i++) {
        const signature = relevant[i];
        if (typeof signature.blockTime !== "number") {
          continue;
        }
        const delta = getPythDeltaForOwnerFromParsedTx(
          parsedTransactions[i],
          ownerAddress
        );
        if (delta !== 0) {
          deltas.push({
            timestampMs: signature.blockTime * 1000,
            delta,
          });
        }
      }
    }

    const oldestInBatch = signatures[signatures.length - 1].blockTime;
    if (
      typeof oldestInBatch === "number" &&
      oldestInBatch < startTimestampSec
    ) {
      break;
    }

    before = signatures[signatures.length - 1].signature;
  }

  return deltas;
}

async function buildDailyHoldingsSeries(
  connection: Connection,
  monthsBack: number
): Promise<Array<{ timestampMs: number; minuteBucketMs: number; totalPythHeld: number }>> {
  const nowMs = Date.now();
  const startDate = new Date(nowMs);
  startDate.setUTCMonth(startDate.getUTCMonth() - monthsBack);
  const startMs = startDate.getTime();
  const startSec = Math.floor(startMs / 1000);

  const [daoCurrent, councilCurrent, daoDeltas, councilDeltas] =
    await Promise.all([
      getPythBalanceForAddress(connection, DAO_TREASURY_ADDRESS),
      getPythBalanceForAddress(connection, PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS),
      fetchPythDeltasForOwnerSince(connection, DAO_TREASURY_ADDRESS, startSec),
      fetchPythDeltasForOwnerSince(
        connection,
        PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS,
        startSec
      ),
    ]);

  const combinedDeltas = daoDeltas
    .concat(councilDeltas)
    .sort((a, b) => b.timestampMs - a.timestampMs);

  const dayMs = 24 * 60 * 60 * 1000;
  const startDayMs = Math.floor(startMs / dayMs) * dayMs;
  const endDayMs = Math.floor(nowMs / dayMs) * dayMs;

  const snapshots: Array<{
    timestampMs: number;
    minuteBucketMs: number;
    totalPythHeld: number;
  }> = [];

  let runningTotal = daoCurrent + councilCurrent;
  let deltaIndex = 0;

  for (let dayCursor = endDayMs; dayCursor >= startDayMs; dayCursor -= dayMs) {
    const dayEndMs = dayCursor + dayMs - 1;
    while (
      deltaIndex < combinedDeltas.length &&
      combinedDeltas[deltaIndex].timestampMs > dayEndMs
    ) {
      runningTotal -= combinedDeltas[deltaIndex].delta;
      deltaIndex += 1;
    }

    snapshots.push({
      timestampMs: dayCursor,
      minuteBucketMs: dayCursor,
      totalPythHeld: Math.max(0, runningTotal),
    });
  }

  return snapshots.sort((a, b) => a.timestampMs - b.timestampMs);
}

export const storePythHoldingSnapshot = internalMutation({
  args: {
    timestampMs: v.number(),
    minuteBucketMs: v.number(),
    totalPythHeld: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pythHoldingSnapshots")
      .withIndex("by_minuteBucketMs", (q) =>
        q.eq("minuteBucketMs", args.minuteBucketMs)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        timestampMs: args.timestampMs,
        totalPythHeld: args.totalPythHeld,
      });
      return existing._id;
    }

    return await ctx.db.insert("pythHoldingSnapshots", {
      timestampMs: args.timestampMs,
      minuteBucketMs: args.minuteBucketMs,
      totalPythHeld: args.totalPythHeld,
    });
  },
});

export const replaceAllPythHoldingSnapshots = internalMutation({
  args: {
    snapshots: v.array(
      v.object({
        timestampMs: v.number(),
        minuteBucketMs: v.number(),
        totalPythHeld: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("pythHoldingSnapshots").collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    for (const snapshot of args.snapshots) {
      await ctx.db.insert("pythHoldingSnapshots", snapshot);
    }

    return {
      deleted: existing.length,
      inserted: args.snapshots.length,
    };
  },
});

export const runPythHoldingSnapshotJob = internalAction({
  args: {},
  handler: async (ctx) => {
    const totalPythHeld = await fetchTotalPythHeldFromChain();
    const timestampMs = Date.now();
    const minuteBucketMs = Math.floor(timestampMs / 60_000) * 60_000;

    await ctx.runMutation(
      internal.reserveSnapshots.storePythHoldingSnapshot,
      {
        timestampMs,
        minuteBucketMs,
        totalPythHeld,
      }
    );

    return {
      timestampMs,
      minuteBucketMs,
      totalPythHeld,
    };
  },
});

export const triggerCurrentPythHoldingSnapshot = mutation({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return await ctx.scheduler.runAfter(
      0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "reserveSnapshots:runPythHoldingSnapshotJob" as any,
      {}
    );
  },
});

export const seedLastTwoMonthsFromChainInternal = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    endpoint: string;
    snapshots: number;
    deleted: number;
    inserted: number;
  }> => {
    let lastError: unknown = null;

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const connection = new Connection(endpoint, CONNECTION_CONFIG);
        const snapshots = await buildDailyHoldingsSeries(connection, 2);
        const result = (await ctx.runMutation(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "reserveSnapshots:replaceAllPythHoldingSnapshots" as any,
          { snapshots }
        )) as { deleted: number; inserted: number };

        return {
          endpoint,
          snapshots: snapshots.length,
          ...result,
        };
      } catch (error) {
        lastError = error;
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : "Unknown error";
    throw new Error(
      `Failed to seed last 2 months of PYTH holdings from chain: ${errorMessage}`
    );
  },
});

export const seedLastMonthFromChainInternal = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    endpoint: string;
    snapshots: number;
    deleted: number;
    inserted: number;
  }> => {
    let lastError: unknown = null;

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const connection = new Connection(endpoint, CONNECTION_CONFIG);
        const snapshots = await buildDailyHoldingsSeries(connection, 1);
        const result = (await ctx.runMutation(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "reserveSnapshots:replaceAllPythHoldingSnapshots" as any,
          { snapshots }
        )) as { deleted: number; inserted: number };

        return {
          endpoint,
          snapshots: snapshots.length,
          ...result,
        };
      } catch (error) {
        lastError = error;
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : "Unknown error";
    throw new Error(
      `Failed to seed last month of PYTH holdings from chain: ${errorMessage}`
    );
  },
});

export const triggerSeedLastTwoMonthsFromChain = mutation({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return await ctx.scheduler.runAfter(
      0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "reserveSnapshots:seedLastTwoMonthsFromChainInternal" as any,
      {}
    );
  },
});

export const triggerSeedLastMonthFromChain = mutation({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return await ctx.scheduler.runAfter(
      0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "reserveSnapshots:seedLastMonthFromChainInternal" as any,
      {}
    );
  },
});

export const getPythHoldingSnapshotStats = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("pythHoldingSnapshots")
      .withIndex("by_timestampMs", (q) => q.gte("timestampMs", 0))
      .order("desc")
      .take(1);

    return {
      count: (await ctx.db.query("pythHoldingSnapshots").collect()).length,
      latestTimestampMs: rows[0]?.timestampMs ?? null,
    };
  },
});

export const seedLastMonthFromCurrentTotal = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    currentTotalPythHeld: number;
    snapshots: number;
    deleted: number;
    inserted: number;
  }> => {
    const currentTotalPythHeld = await fetchTotalPythHeldFromChain();
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const endDayMs = Math.floor(nowMs / dayMs) * dayMs;
    const points = 31;

    const snapshots: Array<{
      timestampMs: number;
      minuteBucketMs: number;
      totalPythHeld: number;
    }> = [];

    for (let i = points - 1; i >= 0; i--) {
      const day = endDayMs - i * dayMs;
      const age = points - 1 - i;
      const trendOffset = (age - (points - 1)) * 220;
      const wave = Math.sin(age / 5) * 1400 + Math.cos(age / 8) * 700;
      const totalPythHeld =
        i === 0
          ? currentTotalPythHeld
          : Math.max(0, currentTotalPythHeld + trendOffset - wave);

      snapshots.push({
        timestampMs: day,
        minuteBucketMs: day,
        totalPythHeld,
      });
    }

    const result = (await ctx.runMutation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "reserveSnapshots:replaceAllPythHoldingSnapshots" as any,
      { snapshots }
    )) as { deleted: number; inserted: number };

    return {
      currentTotalPythHeld,
      snapshots: snapshots.length,
      ...result,
    };
  },
});

export const getPythHoldingHistory = query({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.db
      .query("pythHoldingSnapshots")
      .withIndex("by_timestampMs", (q) => q.gte("timestampMs", 0))
      .order("asc")
      .collect();

    return snapshots.map((snapshot) => ({
      id: snapshot._id,
      timestampMs: snapshot.timestampMs,
      minuteBucketMs: snapshot.minuteBucketMs,
      totalPythHeld: snapshot.totalPythHeld,
    }));
  },
});

export const seedDummyPythHoldingSnapshots = mutation({
  args: {
    hours: v.optional(v.number()),
    intervalHours: v.optional(v.number()),
    baseAmount: v.optional(v.number()),
    hourlyGrowth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hours = Math.max(6, Math.min(args.hours ?? 72, 24 * 30));
    const intervalHours = Math.max(1, Math.min(args.intervalHours ?? 1, 24));
    const baseAmount = args.baseAmount ?? 4_450_000;
    const hourlyGrowth = args.hourlyGrowth ?? 4_800;

    const nowMs = Date.now();
    const intervalMs = intervalHours * 3_600_000;
    const startBucketMs =
      Math.floor((nowMs - hours * 60 * 60 * 1000) / intervalMs) * intervalMs;

    let insertedOrUpdated = 0;
    const pointCount = Math.floor(hours / intervalHours);

    for (let i = 0; i <= pointCount; i++) {
      const elapsedHours = i * intervalHours;
      const bucketMs = startBucketMs + i * intervalMs;
      const trend = baseAmount + elapsedHours * hourlyGrowth;
      const wave = Math.sin(i / 4) * 18_000 + Math.cos(i / 7) * 9_000;
      const noise = ((i * 7919) % 5000) - 2500;
      const totalPythHeld = Math.max(0, trend + wave + noise);

      const existing = await ctx.db
        .query("pythHoldingSnapshots")
        .withIndex("by_minuteBucketMs", (q) => q.eq("minuteBucketMs", bucketMs))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          timestampMs: bucketMs,
          totalPythHeld,
        });
      } else {
        await ctx.db.insert("pythHoldingSnapshots", {
          timestampMs: bucketMs,
          minuteBucketMs: bucketMs,
          totalPythHeld,
        });
      }

      insertedOrUpdated += 1;
    }

    return {
      hours,
      intervalHours,
      insertedOrUpdated,
      startBucketMs,
      endBucketMs: startBucketMs + pointCount * intervalMs,
    };
  },
});
