# Weekly Pyth Digest Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/news` page that shows a stored weekly digest of high-signal Pyth forum activity, generated every Thursday from the Pyth forum Proposals category and rendered in the app's existing subpage visual style.

**Architecture:** Use Convex as the durable source of truth for both normalized weekly forum source items and the generated digest. A weekly Convex internal action fetches recent proposal topics from the live Discourse JSON feed, loads topic JSON for threads active in the weekly window, filters to meaningful posts created in that window, generates a structured digest via the OpenAI Responses API, and saves the result keyed by `weekKey`. The Next.js `/news` page reads the latest digest and archive from Convex and renders them with dashboard-style cards consistent with `/reserve`.

**Tech Stack:** Next.js App Router, TypeScript, Convex, OpenAI Responses API, Vitest, Tailwind CSS, existing `components/ui` primitives.

**Relevant skills:** @convex @nextjs-app-router-patterns @vercel-react-best-practices

---

### Task 1: Add test harness for news-domain utilities

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/news/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

describe("news test harness", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/news/smoke.test.ts`
Expected: FAIL because Vitest is not installed or configured.

- [ ] **Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/news/smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.ts tests/news/smoke.test.ts
git commit -m "test: add vitest harness for news digest"
```

### Task 2: Add pure week-window and formatting utilities with TDD

**Files:**
- Create: `lib/news/week.ts`
- Test: `tests/news/week.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  buildDigestWeekWindow,
  formatWeekKey,
  formatWeekLabel,
} from "@/lib/news/week";

describe("news week helpers", () => {
  it("builds a Thursday-to-Thursday UTC window", () => {
    const end = Date.parse("2026-03-19T00:00:00.000Z");
    const window = buildDigestWeekWindow(end);

    expect(window.startMs).toBe(Date.parse("2026-03-12T00:00:00.000Z"));
    expect(window.endMs).toBe(end);
  });

  it("formats a stable week key", () => {
    expect(formatWeekKey(Date.parse("2026-03-19T00:00:00.000Z"))).toBe(
      "2026-03-19"
    );
  });

  it("formats a user-facing label", () => {
    expect(formatWeekLabel(Date.parse("2026-03-19T00:00:00.000Z"))).toBe(
      "Week of Mar 19, 2026"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/news/week.test.ts`
Expected: FAIL with module not found for `@/lib/news/week`.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildDigestWeekWindow(endMs: number) {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return {
    startMs: endMs - weekMs,
    endMs,
  };
}

export function formatWeekKey(endMs: number) {
  return new Date(endMs).toISOString().slice(0, 10);
}

export function formatWeekLabel(endMs: number) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(endMs));
  return `Week of ${formatted}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/news/week.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/news/week.ts tests/news/week.test.ts
git commit -m "feat: add weekly digest date helpers"
```

### Task 3: Add forum normalization and filtering utilities with TDD

**Files:**
- Create: `lib/news/forum.ts`
- Create: `lib/news/filter.ts`
- Test: `tests/news/forum.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  getCandidateTopicsForWindow,
  normalizeTopicPostToSourceItem,
  stripCookedHtmlToText,
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

    expect(getCandidateTopicsForWindow(topics, { startMs, endMs })).toHaveLength(2);
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
        contentText: "Agree",
        authorUsername: "random",
        signalScore: 0,
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/news/forum.test.ts`
Expected: FAIL with missing modules or missing exports.

- [ ] **Step 3: Write minimal implementation**

```ts
export function getCandidateTopicsForWindow(
  topics: Array<{ created_at: string; last_posted_at: string }>,
  window: { startMs: number; endMs: number }
) {
  return topics.filter((topic) => {
    const createdAt = Date.parse(topic.created_at);
    const lastPostedAt = Date.parse(topic.last_posted_at);
    return (
      (createdAt >= window.startMs && createdAt < window.endMs) ||
      (lastPostedAt >= window.startMs && lastPostedAt < window.endMs)
    );
  });
}

export function stripCookedHtmlToText(cooked: string) {
  return cooked.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
```

Implement `normalizeTopicPostToSourceItem` and `shouldKeepPostForDigest` with the minimum logic required by the tests, then expand during later tasks.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/news/forum.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/news/forum.ts lib/news/filter.ts tests/news/forum.test.ts
git commit -m "feat: add forum normalization and filtering utilities"
```

### Task 4: Add Convex schema for raw news items and weekly digests

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/_generated/*` (generated by codegen)
- Test: `tests/news/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";

describe("news schema", () => {
  it("exports a schema object", () => {
    expect(schema).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/news/schema.test.ts`
Expected: FAIL initially if import path or schema additions are not in place.

- [ ] **Step 3: Write minimal implementation**

Add `newsSourceItems` and `newsDigests` tables to `convex/schema.ts`.

```ts
newsSourceItems: defineTable({
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
})
  .index("by_weekKey", ["weekKey"])
  .index("by_topicId", ["topicId"])
  .index("by_source_and_weekKey", ["source", "weekKey"]),

newsDigests: defineTable({
  weekKey: v.string(),
  rangeStartMs: v.number(),
  rangeEndMs: v.number(),
  status: v.string(),
  title: v.string(),
  summary: v.string(),
  sections: v.array(
    v.object({
      title: v.string(),
      bullets: v.array(v.string()),
    })
  ),
  sourceCounts: v.object({
    forumPosts: v.number(),
    forumTopics: v.number(),
  }),
  model: v.string(),
  promptVersion: v.string(),
  generatedAtMs: v.number(),
  errorMessage: v.optional(v.string()),
})
  .index("by_weekKey", ["weekKey"])
  .index("by_generatedAtMs", ["generatedAtMs"]),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/news/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Run code generation**

Run: `npx convex codegen`
Expected: updated generated API/types.

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/_generated tests/news/schema.test.ts
git commit -m "feat: add schema for weekly news digests"
```

### Task 5: Add OpenAI prompt and response parsing utilities with TDD

**Files:**
- Create: `lib/news/prompt.ts`
- Create: `lib/news/openai.ts`
- Test: `tests/news/openai.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildDigestPrompt } from "@/lib/news/prompt";
import { parseDigestResponse } from "@/lib/news/openai";

describe("news OpenAI helpers", () => {
  it("builds a prompt that forbids outside knowledge", () => {
    const prompt = buildDigestPrompt({
      weekLabel: "Week of Mar 19, 2026",
      sourceItems: [],
    });

    expect(prompt).toContain("Only use the supplied forum content");
  });

  it("parses structured digest output", () => {
    const parsed = parseDigestResponse({
      title: "Weekly Pyth Digest",
      summary: "Quiet week.",
      sections: [{ title: "Proposal activity", bullets: ["No new proposals."] }],
    });

    expect(parsed.sections).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/news/openai.test.ts`
Expected: FAIL with missing helpers.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `buildDigestPrompt`
- `getDigestResponseSchema`
- `parseDigestResponse`

Keep the schema minimal:

```ts
type DigestSection = {
  title: string;
  bullets: string[];
};

type DigestOutput = {
  title: string;
  summary: string;
  sections: DigestSection[];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/news/openai.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/news/prompt.ts lib/news/openai.ts tests/news/openai.test.ts
git commit -m "feat: add OpenAI prompt and parsing utilities for news digest"
```

### Task 6: Implement Convex news pipeline for weekly ingestion and digest generation

**Files:**
- Create: `convex/news.ts`
- Modify: `convex/crons.ts`
- Test: `tests/news/news-pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Create focused tests for pure helpers extracted from the pipeline:
- selecting candidate topics from category JSON
- selecting only posts inside the digest window
- computing source counts

```ts
import { describe, expect, it } from "vitest";
import {
  getDigestWindowPosts,
  summarizeSourceCounts,
} from "@/lib/news/forum";

describe("news pipeline helpers", () => {
  it("keeps only posts inside the weekly window", () => {
    const posts = [
      { created_at: "2026-03-11T23:59:59.000Z" },
      { created_at: "2026-03-12T00:00:00.000Z" },
      { created_at: "2026-03-18T23:59:59.000Z" },
    ];

    expect(
      getDigestWindowPosts(posts, {
        startMs: Date.parse("2026-03-12T00:00:00.000Z"),
        endMs: Date.parse("2026-03-19T00:00:00.000Z"),
      })
    ).toHaveLength(2);
  });

  it("summarizes source counts", () => {
    const counts = summarizeSourceCounts([
      { topicId: 1 },
      { topicId: 1 },
      { topicId: 2 },
    ]);

    expect(counts.forumPosts).toBe(3);
    expect(counts.forumTopics).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/news/news-pipeline.test.ts`
Expected: FAIL until helpers and pipeline exports exist.

- [ ] **Step 3: Write minimal implementation**

In `convex/news.ts`, implement:
- `upsertSourceItems` internal mutation
- `saveDigest` internal mutation
- `getLatestDigest` query
- `listDigests` query
- `triggerDigestGeneration` mutation
- `generateWeeklyDigest` internal action

Pipeline details:
- Fetch `https://forum.pyth.network/c/proposals/7/l/latest.json`
- Keep topics with `created_at` or `last_posted_at` in the window
- Fetch each topic JSON at `/t/{slug}/{id}.json`
- Keep only posts whose `created_at` is in the weekly window
- Normalize and filter posts
- Call OpenAI with structured output
- Save digest keyed by `weekKey`
- Skip rerun when a completed digest already exists for the same `weekKey`, unless explicitly forced

- [ ] **Step 4: Update cron**

In `convex/crons.ts`, add a weekly Thursday job:

```ts
crons.weekly(
  "generate weekly pyth digest",
  { dayOfWeek: "thursday", hourUTC: 1, minuteUTC: 0 },
  internal.news.generateWeeklyDigest,
  {}
);
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- tests/news/news-pipeline.test.ts`
Expected: PASS for helper coverage.

- [ ] **Step 6: Run code generation**

Run: `npx convex codegen`
Expected: API entries for `news`.

- [ ] **Step 7: Commit**

```bash
git add convex/news.ts convex/crons.ts convex/_generated lib/news tests/news/news-pipeline.test.ts
git commit -m "feat: add weekly forum digest pipeline"
```

### Task 7: Add manual trigger support and failure handling

**Files:**
- Modify: `convex/news.ts`
- Test: `tests/news/news-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Add pure helper tests for:
- digest status transitions
- idempotent `weekKey` save behavior
- fallback error payload formatting

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/news/news-actions.test.ts`
Expected: FAIL until helper behavior exists.

- [ ] **Step 3: Write minimal implementation**

Ensure:
- failed generations save a `newsDigests` row with `status: "failed"`
- reruns can be forced from a mutation argument
- success and failure both store `generatedAtMs`
- error messages are trimmed to a safe length

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm run test -- tests/news/news-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/news.ts tests/news/news-actions.test.ts
git commit -m "feat: add robust failure handling for news generation"
```

### Task 8: Build the `/news` page shell aligned with existing subpages

**Files:**
- Create: `app/news/page.tsx`
- Create: `components/news/news-hero.tsx`
- Create: `components/news/news-digest-card.tsx`
- Create: `components/news/news-archive.tsx`
- Modify: `components/sidebar.tsx`

- [ ] **Step 1: Write the failing test or static acceptance checklist**

Use a lightweight UI acceptance checklist if component tests are not already present:
- `/news` appears in the sidebar
- page uses the same width/spacing rhythm as `/reserve`
- hero uses rounded, gradient-backed panel styling consistent with current subpages
- latest digest appears above archive cards

- [ ] **Step 2: Implement the page shell**

`app/news/page.tsx` should:
- be a client component if using `useQuery`
- call `useQuery(api.news.getLatestDigest, {})`
- call `useQuery(api.news.listDigests, { limit: 12 })`
- render loading and empty states with existing card styling

`components/news/news-hero.tsx` should render:
- title: `Weekly Pyth Digest`
- description
- badges for week label and source counts

`components/news/news-digest-card.tsx` should render:
- digest summary
- section cards or blocks
- generated timestamp

`components/news/news-archive.tsx` should render:
- compact archive cards below the main digest
- clickable list or expandable items, depending on the simplest implementation path

Update `components/sidebar.tsx`:
- add `{ href: "/news", label: "News", icon: Newspaper }`

- [ ] **Step 3: Match existing design language**

Follow patterns from `/reserve`:
- rounded corners in the 24px to 30px range
- subdued borders and translucent gradients
- mobile-first stacking
- no blog-style typography overhaul

- [ ] **Step 4: Run the app and visually verify**

Run: `npm run dev`
Check:
- sidebar link appears and highlights correctly
- `/news` loads with loading, empty, and populated states
- design feels like a sibling to `/reserve`, not a separate microsite

- [ ] **Step 5: Commit**

```bash
git add app/news/page.tsx components/news components/sidebar.tsx
git commit -m "feat: add news page and archive UI"
```

### Task 9: Add metadata, polish, and empty-state copy

**Files:**
- Modify: `app/news/page.tsx`
- Modify: `app/layout.tsx` (only if page metadata strategy needs central updates)
- Modify: `components/news/news-hero.tsx`
- Modify: `components/news/news-digest-card.tsx`

- [ ] **Step 1: Add empty and quiet-week UX**

Support these states:
- no digest yet
- failed digest last run
- quiet week with low activity but successful generation

Example quiet-week copy:
- `Quiet week on Pyth proposals. No major new proposal activity, but the archive remains available below.`

- [ ] **Step 2: Add page metadata**

Use page-level metadata in `app/news/page.tsx` if possible:
- title: `Weekly Pyth Digest | Pyth Dashboard`
- description: `Weekly digest of Pyth proposal activity and notable forum discussion`

- [ ] **Step 3: Verify visual polish**

Check:
- line lengths stay readable inside cards
- archive cards do not crowd mobile layouts
- metadata badges do not wrap awkwardly

- [ ] **Step 4: Commit**

```bash
git add app/news/page.tsx app/layout.tsx components/news
git commit -m "feat: polish weekly digest states and metadata"
```

### Task 10: Verify end-to-end behavior before completion

**Files:**
- No new files required

- [ ] **Step 1: Run the relevant tests**

Run: `npm run test -- tests/news`
Expected: PASS.

- [ ] **Step 2: Run static verification**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run app verification**

Run: `npm run dev`
Expected:
- app boots
- `/news` renders
- Convex queries compile

- [ ] **Step 4: Manual smoke test the pipeline**

Use the manual mutation trigger for a test run in dev.
Expected:
- source items persist
- digest row persists
- `/news` shows latest digest and archive

- [ ] **Step 5: Review for YAGNI**

Confirm that V1 does not include:
- X integration
- markdown rendering dependency
- forum write-back/posting
- multiple categories beyond Proposals unless explicitly added during implementation

- [ ] **Step 6: Commit final verification changes**

```bash
git add .
git commit -m "feat: ship weekly pyth digest"
```

## Notes For Implementation

- Use only the live Pyth forum Proposals feed for V1:
  - `https://forum.pyth.network/c/proposals/7/l/latest.json`
- Topic JSON should be fetched per thread:
  - `https://forum.pyth.network/t/{slug}/{topicId}.json`
- Summaries must be based only on posts created during the weekly window.
- Older threads may appear in the digest only when they contain meaningful new posts inside the weekly window.
- Keep rendering structured JSON in the UI rather than storing raw markdown as the primary format.
- Match the page design to the existing subpage language in `app/reserve/page.tsx` and `components/ui/card.tsx`.

Plan complete and saved to `docs/plans/2026-03-18-news-digest-implementation.md`. Ready to execute.
