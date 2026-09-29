import { HOLDER_EXCLUSIONS, HOLDER_EXCLUSION_KEY, EXCLUDED_HOLDER_OWNERS } from "../lib/growth/holderExclusions";
import { v } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import { holderComparison, holderLeaderboardEntry } from "./holderRankingModel";
import { compareHolderRankings, daysBefore, HOLDER_PERIODS, type HolderBalance } from "../lib/growth/holderRankings";

/** Called by the existing holder snapshot mutation, so counts and rankings commit atomically. */
export async function storeHolderRankings(ctx: MutationCtx, args: { date: string; collectedAt: number; holders: number; entries: HolderBalance[] }) {
  if (args.entries.length !== Math.min(100, args.holders) || new Set(args.entries.map(row => row.owner)).size !== args.entries.length ||
    args.entries.some((row, i) => EXCLUDED_HOLDER_OWNERS.has(row.owner) || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(row.owner) || !/^[1-9]\d{0,29}$/.test(row.amount) ||
      (i > 0 && BigInt(args.entries[i - 1].amount) < BigInt(row.amount)))) throw new Error("Invalid PYTH holder ranking");
  const existing = await ctx.db.query("pythHolderRankingSnapshots").withIndex("by_date", q => q.eq("date", args.date)).unique();
  if (existing?.exclusionKey === HOLDER_EXCLUSION_KEY) return;
  const latest = await ctx.db.query("pythHolderLeaderboard").withIndex("by_key", q => q.eq("key", "latest")).unique();
  if (latest && latest.date > args.date) throw new Error("Cannot store an older holder ranking");
  const firstDate = latest?.exclusionKey === HOLDER_EXCLUSION_KEY ? latest.firstDate : args.date;
  const historical = await Promise.all(HOLDER_PERIODS.map(async days => {
    const target = daysBefore(args.date, days);
    if (target < firstDate) return null;
    const row = await ctx.db.query("pythHolderRankingSnapshots").withIndex("by_date", q => q.eq("date", target)).unique();
    return row?.exclusionKey === HOLDER_EXCLUSION_KEY ? row : null;
  }));
  const today = { exclusionKey: HOLDER_EXCLUSION_KEY, date: args.date, collectedAt: args.collectedAt, entries: args.entries };
  const comparisons = compareHolderRankings(today, firstDate, { 1: historical[0], 7: historical[1], 30: historical[2] });
  if (existing) await ctx.db.replace(existing._id, today);
  else await ctx.db.insert("pythHolderRankingSnapshots", today);
  const leaderboard = { exclusionKey: HOLDER_EXCLUSION_KEY, key: "latest" as const, date: args.date, collectedAt: args.collectedAt, firstDate, ...comparisons };
  if (latest) await ctx.db.replace(latest._id, leaderboard);
  else await ctx.db.insert("pythHolderLeaderboard", leaderboard);
  // Bounded cleanup keeps 35 calendar days, including today. No growing-table scans.
  const expired = await ctx.db.query("pythHolderRankingSnapshots")
    .withIndex("by_date", q => q.lt("date", daysBefore(args.date, 34))).take(100);
  for (const row of expired) await ctx.db.delete(row._id);
}

export const latest = query({
  args: {},
  returns: v.union(v.object({ date: v.string(), collectedAt: v.number(), firstDate: v.string(),
    periods: v.array(holderComparison), entries: v.array(holderLeaderboardEntry),
    exclusions: v.array(v.object({ owner: v.string(), label: v.string(), reason: v.string(), source: v.string() })),
  }), v.null()),
  handler: async ctx => {
    const row = await ctx.db.query("pythHolderLeaderboard").withIndex("by_key", q => q.eq("key", "latest")).unique();
    return row?.exclusionKey === HOLDER_EXCLUSION_KEY ? { exclusions: HOLDER_EXCLUSIONS, date: row.date, collectedAt: row.collectedAt, firstDate: row.firstDate, periods: row.periods, entries: row.entries } : null;
  },
});
