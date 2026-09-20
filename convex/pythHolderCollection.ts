"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { collectPythHolders } from "../lib/growth/collector";

export const collect = internalAction({
  args: {}, returns:v.null(),
  handler: async ctx => {
    const date = new Date().toISOString().slice(0,10);
    if (await ctx.runQuery(internal.pythHolders.hasDate,{date})) return null;
    // Collection failures propagate to Convex job logs; no partial snapshot is written.
    const result = await collectPythHolders(process.env.PRIMARY_SOLANA_RPC_URL);
    if (new Date(result.collectedAt).toISOString().slice(0,10) !== date) throw new Error("PYTH scan crossed UTC midnight; retry on the new day");
    console.info("PYTH holder collection", result);
    await ctx.runMutation(internal.pythHolders.store,{
      holders:result.holders,collectedAt:result.collectedAt,totalTokenAccounts:result.totalTokenAccounts,
      positiveTokenAccounts:result.positiveTokenAccounts,
    });
    return null;
  },
});
