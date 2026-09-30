import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, internalQuery, query } from "./_generated/server";

const snapshot = v.object({ date: v.string(), stakers: v.number(), collectedAt: v.number() });
const ranking = v.array(v.object({ owner: v.string(), amount: v.string() }));
const unstakingRanking = v.array(v.object({ owner: v.string(), amount: v.string(),
  cooldowns: v.optional(v.array(v.object({ amount: v.string(), startAt: v.number(), endAt: v.number() }))),
}));
const cooldownSchedule = v.array(v.object({ endAt: v.number(), amount: v.string(), owners: v.number() }));
export const store = internalMutation({
  args: {
    stakers: v.number(), collectedAt: v.number(), epoch: v.string(),
    totalStakeAccounts: v.number(), eligibleStakeAccounts: v.number(),
    topStakers: ranking, topUnstaking: unstakingRanking, cooldownSchedule,
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
    for (const [list, limit] of [[args.topStakers, 100], [args.topUnstaking, 100]] as const) {
      if (list.length > limit || new Set(list.map(row => row.owner)).size !== list.length ||
          list.some((row, i) => !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(row.owner) ||
            !/^[1-9]\d{0,39}$/.test(row.amount) || (i > 0 && BigInt(list[i - 1].amount) < BigInt(row.amount)))) {
        throw new Error("Invalid governance leaderboard");
      }
    }
    const { topStakers, topUnstaking, cooldownSchedule, ...counts } = args;
    for (const row of topUnstaking) {
      if (row.cooldowns !== undefined && (
        row.cooldowns.length === 0 || row.cooldowns.some((period, i) =>
          !/^[1-9]\d{0,39}$/.test(period.amount) ||
          !Number.isSafeInteger(period.startAt) || period.startAt < 0 || period.startAt % 604800000 !== 0 ||
          !Number.isSafeInteger(period.endAt) || period.endAt > 8.64e15 || period.endAt - period.startAt !== 604800000 ||
          (i > 0 && row.cooldowns![i - 1].startAt >= period.startAt)) ||
        row.cooldowns.reduce((sum, period) => sum + BigInt(period.amount), 0n) !== BigInt(row.amount)
      )) throw new Error("Invalid governance cooldowns");
    }
    if (cooldownSchedule.some((period, i) =>
      !Number.isSafeInteger(period.endAt) || period.endAt <= 0 || period.endAt > 8.64e15 || period.endAt % 604800000 !== 0 ||
      !/^[1-9]\d{0,39}$/.test(period.amount) ||
      !Number.isSafeInteger(period.owners) || period.owners <= 0 || period.owners > args.totalStakeAccounts ||
      (i > 0 && cooldownSchedule[i - 1].endAt >= period.endAt))) {
      throw new Error("Invalid governance cooldown schedule");
    }
    // The indexed read and insert are one Convex transaction. OCC protects concurrent runs.
    const existing = await ctx.db.query("pythGovernanceStakerSnapshots")
      .withIndex("by_date", q => q.eq("date", date)).unique();
    if (!existing) await ctx.db.insert("pythGovernanceStakerSnapshots", { date, ...counts });
    const leaderboard = await ctx.db.query("pythGovernanceLeaderboard")
      .withIndex("by_key", q => q.eq("key", "latest")).unique();
    const values = { key: "latest" as const, collectedAt: args.collectedAt, epoch: args.epoch, topStakers, topUnstaking, cooldownSchedule };
    if (!leaderboard) await ctx.db.insert("pythGovernanceLeaderboard", values);
    else if (leaderboard.collectedAt < args.collectedAt) await ctx.db.replace(leaderboard._id, values);
    return null;
  },
});

export const leaderboard = query({
  args: {},
  returns: v.union(v.object({ collectedAt: v.number(), epoch: v.string(), topStakers: ranking, topUnstaking: unstakingRanking,
    cooldownSchedule: v.optional(cooldownSchedule) }), v.null()),
  handler: async ctx => {
    const row = await ctx.db.query("pythGovernanceLeaderboard")
      .withIndex("by_key", q => q.eq("key", "latest")).unique();
    return row ? { collectedAt: row.collectedAt, epoch: row.epoch, topStakers: row.topStakers, topUnstaking: row.topUnstaking,
      cooldownSchedule: row.cooldownSchedule } : null;
  },
});

export const hasDate = internalQuery({
  args: { date: v.string() }, returns: v.boolean(),
  handler: async (ctx, { date }) => {
    const count = await ctx.db.query("pythGovernanceStakerSnapshots")
      .withIndex("by_date", q => q.eq("date", date)).unique();
    if (!count) return false;
    // Existing count history predates rankings. Allow one scan to seed the leaderboard.
    const ranking = await ctx.db.query("pythGovernanceLeaderboard")
      .withIndex("by_key", q => q.eq("key", "latest")).unique();
    return !!ranking && ranking.topStakers.length >= Math.min(100, count.stakers) &&
      ranking.cooldownSchedule !== undefined && ranking.topUnstaking.every(row => row.cooldowns !== undefined) &&
      new Date(ranking.collectedAt).toISOString().slice(0, 10) >= date;
  },
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
