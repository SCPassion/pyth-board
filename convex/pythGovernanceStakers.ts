import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, internalQuery, query } from "./_generated/server";

const snapshot = v.object({ date: v.string(), stakers: v.number(), collectedAt: v.number() });
export const store = internalMutation({
  args: {
    stakers: v.number(), collectedAt: v.number(), epoch: v.string(),
    totalStakeAccounts: v.number(), eligibleStakeAccounts: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.stakers) || args.stakers <= 0 ||
        !Number.isSafeInteger(args.collectedAt) || args.collectedAt <= 0 ||
        !Number.isSafeInteger(args.totalStakeAccounts) || !Number.isSafeInteger(args.eligibleStakeAccounts) ||
        args.totalStakeAccounts < args.eligibleStakeAccounts || args.eligibleStakeAccounts < args.stakers ||
        !/^(0|[1-9]\d{0,19})$/.test(args.epoch)) {
      throw new Error("Invalid governance staker snapshot");
    }
    const date = new Date(args.collectedAt).toISOString().slice(0, 10);
    // The indexed read and insert are one Convex transaction. OCC protects concurrent runs.
    const existing = await ctx.db.query("pythGovernanceStakerSnapshots")
      .withIndex("by_date", q => q.eq("date", date)).unique();
    if (!existing) await ctx.db.insert("pythGovernanceStakerSnapshots", { date, ...args });
    return null;
  },
});

export const hasDate = internalQuery({
  args: { date: v.string() }, returns: v.boolean(),
  handler: async (ctx, { date }) => !!await ctx.db.query("pythGovernanceStakerSnapshots")
    .withIndex("by_date", q => q.eq("date", date)).unique(),
});

export const latest = query({
  args: {}, returns: v.union(snapshot, v.null()),
  handler: async ctx => {
    const row = await ctx.db.query("pythGovernanceStakerSnapshots").withIndex("by_date").order("desc").first();
    return row ? { date: row.date, stakers: row.stakers, collectedAt: row.collectedAt } : null;
  },
});

export const history = query({
  args: { since: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(snapshot), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("pythGovernanceStakerSnapshots")
      .withIndex("by_date", q => q.gte("date", args.since)).order("asc").paginate(args.paginationOpts);
    return { isDone: result.isDone, continueCursor: result.continueCursor,
      page: result.page.map(({ date, stakers, collectedAt }) => ({ date, stakers, collectedAt })) };
  },
});
