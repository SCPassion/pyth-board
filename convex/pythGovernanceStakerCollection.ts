"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { collectGovernanceStakers } from "../lib/growth/governanceCollector";

export const collect = internalAction({
  args: {}, returns: v.null(),
  handler: async ctx => {
    const date = new Date().toISOString().slice(0, 10);
    if (await ctx.runQuery(internal.pythGovernanceStakers.hasDate, { date })) {
      console.info("Governance staker collection skipped: snapshot exists", { date });
      return null;
    }
    const result = await collectGovernanceStakers(process.env.PRIMARY_SOLANA_RPC_URL);
    if (new Date(result.collectedAt).toISOString().slice(0, 10) !== date) throw new Error("Governance scan crossed UTC midnight");
    console.info("Governance staker collection", { ...result, nodeVersion: process.version, peakRssMiB: process.resourceUsage().maxRSS / 1024 });
    await ctx.runMutation(internal.pythGovernanceStakers.store, {
      stakers: result.stakers, collectedAt: result.collectedAt, epoch: result.epoch,
      totalStakeAccounts: result.totalStakeAccounts, eligibleStakeAccounts: result.eligibleStakeAccounts,
    });
    return null;
  },
});
