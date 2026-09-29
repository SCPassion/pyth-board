import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { holderBalance } from "./holderRankingModel";
import { HOLDER_EXCLUSION_KEY } from "../lib/growth/holderExclusions";
import { storeHolderRankings } from "./pythHolderRankings";

const snapshot = v.object({ date: v.string(), holders: v.number(), collectedAt: v.number() });
export const store = internalMutation({
  args: { eligibleHolders: v.optional(v.number()), holders: v.number(), collectedAt: v.number(), totalTokenAccounts: v.number(), positiveTokenAccounts: v.number(), topHolders: v.optional(v.array(holderBalance)) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.holders) || args.holders <= 0 ||
      !Number.isSafeInteger(args.collectedAt) || args.collectedAt <= 0 ||
      !Number.isSafeInteger(args.totalTokenAccounts) || !Number.isSafeInteger(args.positiveTokenAccounts) ||
      args.totalTokenAccounts < args.positiveTokenAccounts || args.positiveTokenAccounts < args.holders) {
      throw new Error("Invalid PYTH holder snapshot");
    }
    const date = new Date(args.collectedAt).toISOString().slice(0,10);
    const { topHolders, eligibleHolders, ...counts } = args;
    // Let an older in-flight collector finish storing counts during deployment.
    if (topHolders !== undefined || eligibleHolders !== undefined) {
      if (topHolders === undefined || eligibleHolders === undefined ||
        !Number.isSafeInteger(eligibleHolders) || eligibleHolders < 0 || eligibleHolders > args.holders) {
        throw new Error("Invalid PYTH holder ranking arguments");
      }
      await storeHolderRankings(ctx, { date, collectedAt: args.collectedAt, holders: eligibleHolders, entries: topHolders });
    }
    const existing = await ctx.db.query("pythHolderSnapshots").withIndex("by_date", q => q.eq("date", date)).unique();
    if (!existing) await ctx.db.insert("pythHolderSnapshots", {date,...counts});
    return null;
  },
});
export const hasDate = internalQuery({
  args: {date:v.string()}, returns:v.boolean(),
  handler: async(ctx,{date}) => {
    const count = await ctx.db.query("pythHolderSnapshots").withIndex("by_date",q=>q.eq("date",date)).unique();
    if (!count) return false;
    const ranking = await ctx.db.query("pythHolderRankingSnapshots").withIndex("by_date",q=>q.eq("date",date)).unique();
    return ranking?.exclusionKey === HOLDER_EXCLUSION_KEY;
  },
});
export const latest = query({
  args: {}, returns:v.union(snapshot,v.null()),
  handler: async ctx => {
    const row = await ctx.db.query("pythHolderSnapshots").withIndex("by_date").order("desc").first();
    return row ? {date:row.date,holders:row.holders,collectedAt:row.collectedAt} : null;
  },
});
export const history = query({
  args: { since:v.string(), paginationOpts:paginationOptsValidator },
  returns:v.object({page:v.array(snapshot),isDone:v.boolean(),continueCursor:v.string()}),
  handler: async(ctx,args) => {
    const result = await ctx.db.query("pythHolderSnapshots").withIndex("by_date",q=>q.gte("date",args.since))
      .order("asc").paginate(args.paginationOpts);
    return {isDone:result.isDone,continueCursor:result.continueCursor,
      page:result.page.map(({date,holders,collectedAt})=>({date,holders,collectedAt}))};
  },
});
