import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { buildDigestPrompt } from "../lib/news/prompt";
import {
  getDigestResponseSchema,
  parseDigestResponse,
  type DigestOutput,
} from "../lib/news/openai";
import {
  getCandidateTopicsForWindow,
  getDigestWindowPosts,
  normalizeTopicPostToSourceItem,
  summarizeSourceCounts,
} from "../lib/news/forum";
import { shouldKeepPostForDigest } from "../lib/news/filter";
import {
  buildDigestWeekWindow,
  formatWeekKey,
  formatWeekLabel,
} from "../lib/news/week";

const FORUM_BASE_URL = "https://forum.pyth.network";
const FORUM_CATEGORY_FEEDS = [
  {
    category: "proposals",
    url: `${FORUM_BASE_URL}/c/proposals/7/l/latest.json`,
  },
  {
    category: "ideas-bank",
    url: `${FORUM_BASE_URL}/c/ideas-bank/2/l/latest.json`,
  },
] as const;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const PROMPT_VERSION = "v1";

const digestSectionValidator = v.object({
  title: v.string(),
  summary: v.optional(v.string()),
  bullets: v.optional(v.array(v.string())),
  sources: v.optional(
    v.array(
      v.object({
        label: v.string(),
        url: v.string(),
      })
    )
  ),
});

const sourceItemValidator = v.object({
  source: v.string(),
  category: v.string(),
  topicId: v.number(),
  postId: v.number(),
  topicTitle: v.string(),
  topicSlug: v.string(),
  url: v.string(),
  authorUsername: v.string(),
  authorName: v.optional(v.string()),
  createdAtMs: v.number(),
  weekKey: v.string(),
  isTopicOp: v.boolean(),
  isNewTopicThisWeek: v.boolean(),
  contentText: v.string(),
  rawJson: v.string(),
  signalScore: v.number(),
});

type DigestSection = {
  title: string;
  summary?: string;
  bullets?: string[];
  sources?: Array<{
    label: string;
    url: string;
  }>;
};

type SourceItem = {
  source: string;
  category: string;
  topicId: number;
  postId: number;
  topicTitle: string;
  topicSlug: string;
  url: string;
  authorUsername: string;
  authorName?: string;
  createdAtMs: number;
  weekKey: string;
  isTopicOp: boolean;
  isNewTopicThisWeek: boolean;
  contentText: string;
  rawJson: string;
  signalScore: number;
};

type ForumTopic = {
  id: number;
  slug: string;
  title: string;
  created_at: string;
  last_posted_at: string;
};

type ForumTopicPost = {
  id: number;
  post_number: number;
  created_at: string;
  username: string;
  name?: string | null;
  cooked: string;
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

function getDigestEndMs(nowMs: number) {
  const now = new Date(nowMs);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

async function collectForumSourceItems(input: {
  weekKey: string;
  rangeStartMs: number;
  rangeEndMs: number;
}): Promise<SourceItem[]> {
  const topicItems = await Promise.all(
    FORUM_CATEGORY_FEEDS.map(async ({ category, url }) => {
      const latest = await fetchJson<{
        topic_list?: {
          topics?: ForumTopic[];
        };
      }>(url);

      const candidateTopics = getCandidateTopicsForWindow(
        latest.topic_list?.topics ?? [],
        {
          startMs: input.rangeStartMs,
          endMs: input.rangeEndMs,
        }
      );

      return await Promise.all(
        candidateTopics.map(async (topic) => {
          const topicJson = await fetchJson<{
            post_stream?: {
              posts?: ForumTopicPost[];
            };
          }>(`${FORUM_BASE_URL}/t/${topic.slug}/${topic.id}.json`);

          const weeklyPosts = getDigestWindowPosts(
            topicJson.post_stream?.posts ?? [],
            {
              startMs: input.rangeStartMs,
              endMs: input.rangeEndMs,
            }
          );

          return weeklyPosts
            .map((post) =>
              normalizeTopicPostToSourceItem({
                category,
                weekKey: input.weekKey,
                topic,
                post,
                rangeStartMs: input.rangeStartMs,
              })
            )
            .filter((item) => shouldKeepPostForDigest(item));
        })
      );
    })
  );

  return topicItems
    .flat(2)
    .sort((a, b) => a.createdAtMs - b.createdAtMs);
}

function buildQuietWeekDigest(weekLabel: string) {
  return {
    title: `Weekly Pyth Digest`,
    summary: `Quiet week on the Pyth forum for ${weekLabel}. No major proposal or ideas activity made the digest threshold.`,
    sections: [
      {
        title: "Forum activity",
        summary:
          "No major proposal or ideas activity reached the weekly digest threshold.",
        sources: [],
      },
    ],
  };
}

function getResponseText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    for (const outputItem of payload.output) {
      if (
        outputItem &&
        typeof outputItem === "object" &&
        "content" in outputItem &&
        Array.isArray(outputItem.content)
      ) {
        for (const contentItem of outputItem.content) {
          if (
            contentItem &&
            typeof contentItem === "object" &&
            "type" in contentItem &&
            contentItem.type === "output_text" &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
          ) {
            return contentItem.text;
          }
        }
      }
    }
  }

  throw new Error("OpenAI response did not include output text");
}

async function generateDigestWithOpenAI(input: {
  weekLabel: string;
  sourceItems: SourceItem[];
}): Promise<DigestOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const prompt = buildDigestPrompt(input);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You summarize Pyth forum proposal activity for retail PYTH holders.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "weekly_pyth_digest",
          strict: true,
          schema: getDigestResponseSchema(),
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI Responses API failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = getResponseText(payload);
  return parseDigestResponse(JSON.parse(outputText) as DigestOutput);
}

export const upsertSourceItems = internalMutation({
  args: {
    weekKey: v.string(),
    items: v.array(sourceItemValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("newsSourceItems")
      .withIndex("by_weekKey", (q) => q.eq("weekKey", args.weekKey))
      .collect();

    await Promise.all(existing.map((doc) => ctx.db.delete(doc._id)));

    const insertedIds = [];
    for (const item of args.items) {
      insertedIds.push(await ctx.db.insert("newsSourceItems", item));
    }

    return insertedIds;
  },
});

export const saveDigest = internalMutation({
  args: {
    weekKey: v.string(),
    rangeStartMs: v.number(),
    rangeEndMs: v.number(),
    status: v.string(),
    title: v.string(),
    summary: v.string(),
    sections: v.array(digestSectionValidator),
    sourceCounts: v.object({
      forumPosts: v.number(),
      forumTopics: v.number(),
    }),
    model: v.string(),
    promptVersion: v.string(),
    generatedAtMs: v.number(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("newsDigests")
      .withIndex("by_weekKey", (q) => q.eq("weekKey", args.weekKey))
      .first();

    const digest = {
      weekKey: args.weekKey,
      rangeStartMs: args.rangeStartMs,
      rangeEndMs: args.rangeEndMs,
      status: args.status,
      title: args.title,
      summary: args.summary,
      sections: args.sections,
      sourceCounts: args.sourceCounts,
      model: args.model,
      promptVersion: args.promptVersion,
      generatedAtMs: args.generatedAtMs,
      errorMessage: args.errorMessage,
    };

    if (existing) {
      await ctx.db.patch(existing._id, digest);
      return existing._id;
    }

    return await ctx.db.insert("newsDigests", digest);
  },
});

export const getDigestByWeekKey = query({
  args: {
    weekKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsDigests")
      .withIndex("by_weekKey", (q) => q.eq("weekKey", args.weekKey))
      .first();
  },
});

export const getLatestDigest = query({
  args: {},
  handler: async (ctx) => {
    const digests = await ctx.db
      .query("newsDigests")
      .withIndex("by_generatedAtMs")
      .order("desc")
      .collect();

    return digests.find((digest) => digest.status === "completed") ?? null;
  },
});

export const listDigests = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 12, 24));
    const digests = await ctx.db
      .query("newsDigests")
      .withIndex("by_generatedAtMs")
      .order("desc")
      .take(limit);

    return digests.filter((digest) => digest.status === "completed");
  },
});

export const generateWeeklyDigest = internalAction({
  args: {
    force: v.optional(v.boolean()),
    endMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const digestEndMs = getDigestEndMs(args.endMs ?? Date.now());
    const { startMs: rangeStartMs, endMs: rangeEndMs } =
      buildDigestWeekWindow(digestEndMs);
    const weekKey = formatWeekKey(digestEndMs);
    const existing = (await ctx.runQuery("news:getDigestByWeekKey" as any, {
      weekKey,
    })) as
      | {
          status: string;
        }
      | null;

    if (existing?.status === "completed" && !args.force) {
      return {
        skipped: true,
        weekKey,
      };
    }

    const generatedAtMs = Date.now();
    const weekLabel = formatWeekLabel(digestEndMs);
    const model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;

    try {
      const sourceItems = await collectForumSourceItems({
        weekKey,
        rangeStartMs,
        rangeEndMs,
      });

      await ctx.runMutation("news:upsertSourceItems" as any, {
        weekKey,
        items: sourceItems,
      });

      const sourceCounts = summarizeSourceCounts(sourceItems);
      const digest =
        sourceItems.length === 0
          ? buildQuietWeekDigest(weekLabel)
          : await generateDigestWithOpenAI({
              weekLabel,
              sourceItems,
            });

      await ctx.runMutation("news:saveDigest" as any, {
        weekKey,
        rangeStartMs,
        rangeEndMs,
        status: "completed",
        title: digest.title,
        summary: digest.summary,
        sections: digest.sections as DigestSection[],
        sourceCounts,
        model,
        promptVersion: PROMPT_VERSION,
        generatedAtMs,
        errorMessage: undefined,
      });

      return {
        weekKey,
        sourceCounts,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation("news:saveDigest" as any, {
        weekKey,
        rangeStartMs,
        rangeEndMs,
        status: "failed",
        title: "Weekly Pyth Digest",
        summary: "Digest generation failed.",
        sections: [],
        sourceCounts: {
          forumPosts: 0,
          forumTopics: 0,
        },
        model,
        promptVersion: PROMPT_VERSION,
        generatedAtMs,
        errorMessage: errorMessage.slice(0, 500),
      });

      throw error;
    }
  },
});

export const triggerDigestGeneration = mutation({
  args: {
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.scheduler.runAfter(
      0,
      "news:generateWeeklyDigest" as any,
      {
        force: args.force,
      }
    );
  },
});
