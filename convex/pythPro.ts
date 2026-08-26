import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { parseDouroReportPost } from "../lib/pyth-pro/forum";
import {
  selectChangedDouroTopics,
  type ForumCategoryTopic,
  type KnownDouroTopic,
} from "../lib/pyth-pro/sync";

const FORUM_BASE_URL = "https://forum.pyth.network";
const PYTH_PRO_CATEGORY_URL = `${FORUM_BASE_URL}/c/pyth-pro/l/latest.json`;

const revenueRowValidator = v.object({
  product: v.string(),
  splitLabel: v.optional(v.string()),
  grossRevenueUsd: v.optional(v.number()),
  daoShareUsd: v.optional(v.number()),
  daoSharePyth: v.optional(v.number()),
  douroLabsUsd: v.optional(v.number()),
  isTotal: v.boolean(),
});

const distributionValidator = v.object({
  tokenAmount: v.optional(v.number()),
  usdValue: v.optional(v.number()),
  tokenSymbol: v.union(v.literal("PYTH"), v.literal("USDC")),
  twapUsd: v.optional(v.number()),
  pythPerUsd: v.optional(v.number()),
});

const legacySummaryRowValidator = v.object({
  label: v.string(),
  usdValue: v.number(),
});

const publicReportValidator = v.object({
  _id: v.id("pythProReports"),
  _creationTime: v.number(),
  topicId: v.number(),
  title: v.string(),
  slug: v.string(),
  url: v.string(),
  authorUsername: v.string(),
  createdAtMs: v.number(),
  lastPostedAtMs: v.number(),
  highestPostNumber: v.number(),
  reportPeriodLabel: v.optional(v.string()),
  distribution: v.optional(distributionValidator),
  monthlyRevenueRows: v.array(revenueRowValidator),
  cumulativeRevenueRows: v.array(revenueRowValidator),
  legacySummaryRows: v.array(legacySummaryRowValidator),
  monthlyGrossRevenueUsd: v.optional(v.number()),
  monthlyDaoShareUsd: v.optional(v.number()),
  monthlyDouroLabsUsd: v.optional(v.number()),
  cumulativeGrossRevenueUsd: v.optional(v.number()),
  cumulativeDaoShareUsd: v.optional(v.number()),
  cumulativeDouroLabsUsd: v.optional(v.number()),
  syncedAtMs: v.number(),
});

const upsertReportValidator = v.object({
  topicId: v.number(),
  title: v.string(),
  slug: v.string(),
  url: v.string(),
  authorUsername: v.string(),
  createdAtMs: v.number(),
  lastPostedAtMs: v.number(),
  highestPostNumber: v.number(),
  reportPeriodLabel: v.optional(v.string()),
  distribution: v.optional(distributionValidator),
  monthlyRevenueRows: v.array(revenueRowValidator),
  cumulativeRevenueRows: v.array(revenueRowValidator),
  legacySummaryRows: v.array(legacySummaryRowValidator),
  monthlyGrossRevenueUsd: v.optional(v.number()),
  monthlyDaoShareUsd: v.optional(v.number()),
  monthlyDouroLabsUsd: v.optional(v.number()),
  cumulativeGrossRevenueUsd: v.optional(v.number()),
  cumulativeDaoShareUsd: v.optional(v.number()),
  cumulativeDouroLabsUsd: v.optional(v.number()),
  rawCooked: v.string(),
  syncedAtMs: v.number(),
});

type CategoryFeed = {
  topic_list?: {
    topics?: ForumCategoryTopic[];
  };
};

type TopicJson = {
  id?: number;
  slug?: string;
  title?: string;
  created_at?: string;
  last_posted_at?: string | null;
  highest_post_number?: number;
  post_stream?: {
    posts?: Array<{
      post_number: number;
      username: string;
      cooked: string;
      created_at: string;
    }>;
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "PythBoard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const listReports = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(publicReportValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 24, 1), 100);
    const docs = await ctx.db
      .query("pythProReports")
      .withIndex("by_createdAtMs")
      .order("desc")
      .take(limit);

    return docs.map(({ rawCooked: _rawCooked, ...doc }) => doc);
  },
});

export const getKnownTopicCursors = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      topicId: v.number(),
      lastPostedAtMs: v.number(),
      highestPostNumber: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("pythProReports")
      .withIndex("by_topicId")
      .take(200);

    return docs.map((doc) => ({
      topicId: doc.topicId,
      lastPostedAtMs: doc.lastPostedAtMs,
      highestPostNumber: doc.highestPostNumber,
    }));
  },
});

export const upsertReport = internalMutation({
  args: { report: upsertReportValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pythProReports")
      .withIndex("by_topicId", (q) => q.eq("topicId", args.report.topicId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args.report);
      return null;
    }

    await ctx.db.insert("pythProReports", args.report);
    return null;
  },
});

export const syncDouroReports = internalAction({
  args: { force: v.optional(v.boolean()) },
  returns: v.object({
    checkedTopics: v.number(),
    changedTopics: v.number(),
    upsertedReports: v.number(),
  }),
  handler: async (ctx, args) => {
    const category = await fetchJson<CategoryFeed>(PYTH_PRO_CATEGORY_URL);
    const topics = category.topic_list?.topics ?? [];
    const knownRows = await ctx.runQuery(internal.pythPro.getKnownTopicCursors, {});
    const knownTopics = new Map<number, KnownDouroTopic>(
      knownRows.map((row) => [
        row.topicId,
        {
          lastPostedAtMs: row.lastPostedAtMs,
          highestPostNumber: row.highestPostNumber,
        },
      ])
    );
    const changedTopics = selectChangedDouroTopics(topics, knownTopics, {
      force: args.force ?? false,
    });
    let upsertedReports = 0;

    for (const topic of changedTopics) {
      const topicJson = await fetchJson<TopicJson>(
        `${FORUM_BASE_URL}/t/${topic.slug}/${topic.id}.json`
      );
      const op = topicJson.post_stream?.posts?.find(
        (post) => post.post_number === 1
      );
      if (!op) continue;

      const parsed = parseDouroReportPost({
        topicId: topic.id,
        title: topic.title,
        slug: topic.slug,
        url: `${FORUM_BASE_URL}/t/${topic.slug}/${topic.id}`,
        authorUsername: op.username,
        createdAt: topic.created_at,
        lastPostedAt: topic.last_posted_at ?? topic.created_at,
        highestPostNumber: topic.highest_post_number ?? 1,
        cooked: op.cooked,
      });

      await ctx.runMutation(internal.pythPro.upsertReport, {
        report: {
          ...parsed,
          rawCooked: op.cooked,
          syncedAtMs: Date.now(),
        },
      });
      upsertedReports += 1;
    }

    return {
      checkedTopics: topics.length,
      changedTopics: changedTopics.length,
      upsertedReports,
    };
  },
});
