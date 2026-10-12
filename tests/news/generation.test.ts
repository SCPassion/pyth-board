/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import { buildDigestWeekWindow, formatWeekKey } from "../../lib/news/week";

const modules = import.meta.glob("../../convex/**/*.ts");
const endMs = Date.UTC(2026, 9, 8);
const weekKey = formatWeekKey(endMs);

afterEach(() => vi.unstubAllGlobals());

describe("weekly digest function references", () => {
  it("skips a completed week without requesting external data", async () => {
    const t = convexTest(schema, modules);
    const window = buildDigestWeekWindow(endMs);
    await t.mutation(internal.news.saveDigest, {
      weekKey, rangeStartMs: window.startMs, rangeEndMs: window.endMs,
      status: "completed", title: "Existing digest", summary: "Already generated",
      sections: [], sourceCounts: { forumPosts: 0, forumTopics: 0 },
      model: "test", promptVersion: "v1", generatedAtMs: endMs,
    });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    expect(await t.action(internal.news.generateWeeklyDigest, { endMs })).toEqual({ skipped: true, weekKey });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("persists a quiet-week digest through the internal mutations", async () => {
    const t = convexTest(schema, modules);
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ topic_list: { topics: [] } })));
    vi.stubGlobal("fetch", fetcher);

    expect(await t.action(internal.news.generateWeeklyDigest, { endMs })).toEqual({
      weekKey, sourceCounts: { forumPosts: 0, forumTopics: 0 },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await t.query(api.news.getDigestByWeekKey, { weekKey })).toMatchObject({
      weekKey, status: "completed", title: "Weekly Pyth Digest",
      sourceCounts: { forumPosts: 0, forumTopics: 0 },
    });
  });

  it("saves the failure before propagating a forum error", async () => {
    const t = convexTest(schema, modules);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Forum unavailable")));

    await expect(t.action(internal.news.generateWeeklyDigest, { endMs })).rejects.toThrow("Forum unavailable");
    expect(await t.query(api.news.getDigestByWeekKey, { weekKey })).toMatchObject({
      status: "failed", errorMessage: "Forum unavailable",
    });
  });

  it("schedules the internal generator with the requested force flag", async () => {
    const t = convexTest(schema, modules);
    const jobId = await t.mutation(api.news.triggerDigestGeneration, { force: true });
    const job = await t.run(ctx => ctx.db.system.get(jobId));
    expect(job).toMatchObject({ name: "news:generateWeeklyDigest", args: [{ force: true }] });
  });
});
