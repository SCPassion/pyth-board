import { Connection, PublicKey } from "@solana/web3.js";
import { v } from "convex/values";
import {
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
