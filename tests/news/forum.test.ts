import { describe, expect, it } from "vitest";
import {
  getCandidateTopicsForWindow,
  normalizeTopicPostToSourceItem,
  stripCookedHtmlToText,
  getDigestWindowPosts,
  summarizeSourceCounts,
} from "@/lib/news/forum";
import { shouldKeepPostForDigest } from "@/lib/news/filter";

describe("forum news utilities", () => {
  const startMs = Date.parse("2026-03-12T00:00:00.000Z");
  const endMs = Date.parse("2026-03-19T00:00:00.000Z");

  it("keeps topics created or updated inside the digest window", () => {
    const topics = [
      {
        id: 1,
        slug: "fresh-proposal",
        title: "Fresh Proposal",
        created_at: "2026-03-14T12:00:00.000Z",
        last_posted_at: "2026-03-14T12:00:00.000Z",
      },
      {
        id: 2,
        slug: "older-thread",
        title: "Older Thread",
        created_at: "2026-03-01T12:00:00.000Z",
        last_posted_at: "2026-03-16T12:00:00.000Z",
      },
      {
        id: 3,
        slug: "stale-thread",
        title: "Stale Thread",
        created_at: "2026-03-01T12:00:00.000Z",
        last_posted_at: "2026-03-05T12:00:00.000Z",
      },
    ];

    expect(getCandidateTopicsForWindow(topics, { startMs, endMs })).toHaveLength(
      2
    );
  });

  it("converts cooked HTML into text", () => {
    expect(stripCookedHtmlToText("<p>Hello <strong>world</strong></p>")).toBe(
      "Hello world"
    );
  });

  it("marks OP posts for new topics correctly", () => {
    const item = normalizeTopicPostToSourceItem({
      category: "proposals",
      weekKey: "2026-03-19",
      topic: {
        id: 2401,
        slug: "laas",
        title: "LaaS",
        created_at: "2026-03-14T00:00:00.000Z",
      },
      post: {
        id: 6549,
        post_number: 1,
        created_at: "2026-03-14T00:00:00.000Z",
        username: "zenyas",
        name: "Yaser",
        cooked: "<p>Proposal body</p>",
      },
      rangeStartMs: startMs,
    });

    expect(item.isTopicOp).toBe(true);
    expect(item.isNewTopicThisWeek).toBe(true);
    expect(item.url).toContain("/t/laas/2401/1");
  });

  it("filters out low-signal replies", () => {
    expect(
      shouldKeepPostForDigest({
        isTopicOp: false,
        isNewTopicThisWeek: false,
        contentText: "Agree",
        authorUsername: "random",
        signalScore: 0,
      })
    ).toBe(false);
  });

  it("keeps substantive replies for older active threads with a lower threshold", () => {
    expect(
      shouldKeepPostForDigest({
        isTopicOp: false,
        isNewTopicThisWeek: false,
        contentText: "30 day grace is right",
        authorUsername: "community-member",
        signalScore: 24,
      })
    ).toBe(true);
  });

  it("keeps only posts inside the weekly window", () => {
    const posts = [
      { created_at: "2026-03-11T23:59:59.000Z" },
      { created_at: "2026-03-12T00:00:00.000Z" },
      { created_at: "2026-03-18T23:59:59.000Z" },
    ];

    expect(getDigestWindowPosts(posts, { startMs, endMs })).toHaveLength(2);
  });

  it("summarizes source counts", () => {
    const counts = summarizeSourceCounts([
      { topicId: 1, category: "proposals" },
      { topicId: 1, category: "proposals" },
      { topicId: 2, category: "ideas-bank" },
    ]);

    expect(counts.forumPosts).toBe(3);
    expect(counts.forumTopics).toBe(2);
  });
});
