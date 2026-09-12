import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, internalQuery, query } from "./_generated/server";

const snapshot = v.object({ date: v.string(), holders: v.number(), collectedAt: v.number() });
export const store = internalMutation({
  args: { holders: v.number(), collectedAt: v.number(), totalTokenAccounts: v.number(), positiveTokenAccounts: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.holders) || args.holders <= 0 ||
      !Number.isSafeInteger(args.collectedAt) || args.collectedAt <= 0 ||
      !Number.isSafeInteger(args.totalTokenAccounts) || !Number.isSafeInteger(args.positiveTokenAccounts) ||
      args.totalTokenAccounts < args.positiveTokenAccounts || args.positiveTokenAccounts < args.holders) {
      throw new Error("Invalid PYTH holder snapshot");
    }
    const date = new Date(args.collectedAt).toISOString().slice(0,10);
    const existing = await ctx.db.query("pythHolderSnapshots").withIndex("by_date", q => q.eq("date", date)).unique();
    if (!existing) await ctx.db.insert("pythHolderSnapshots", {date,...args});
    return null;
  },
});
export const hasDate = internalQuery({
  args: {date:v.string()}, returns:v.boolean(),
  handler: async(ctx,{date}) => !!await ctx.db.query("pythHolderSnapshots").withIndex("by_date",q=>q.eq("date",date)).unique(),
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
