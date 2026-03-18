import { describe, expect, it } from "vitest";
import { buildDigestPrompt } from "@/lib/news/prompt";
import { parseDigestResponse } from "@/lib/news/openai";

describe("news OpenAI helpers", () => {
  it("builds a prompt that forbids outside knowledge", () => {
    const prompt = buildDigestPrompt({
      weekLabel: "Week of Mar 19, 2026",
      sourceItems: [
        {
          topicTitle: "LaaS",
          authorUsername: "zenyas",
          url: "https://forum.pyth.network/t/laas/2401/1",
          contentText: "Proposal body",
        },
      ],
    });

    expect(prompt).toContain("Only use the supplied forum content");
    expect(prompt).toContain("Every section must include source links");
    expect(prompt).toContain("Write each section as clean prose, not bullets");
    expect(prompt).toContain("Do not put URLs or source references in the summary text");
  });

  it("parses structured digest output", () => {
    const parsed = parseDigestResponse({
      title: "Weekly Pyth Digest",
      summary: "Quiet week.",
      sections: [
        {
          title: "Proposal activity",
          summary:
            "No new proposals. (Sources: [1](https://forum.pyth.network/t/example/1))",
          sources: [
            {
              label: "Forum thread",
              url: "https://forum.pyth.network/t/example/1",
            },
          ],
        },
      ],
    });

    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0].sources).toHaveLength(1);
    expect(parsed.sections[0].summary).toBe("No new proposals.");
  });

  it("can normalize legacy bullet sections into a prose summary", () => {
    const parsed = parseDigestResponse({
      title: "Weekly Pyth Digest",
      summary: "Quiet week.",
      sections: [
        {
          title: "Proposal activity",
          bullets: ["First point.", "Second point."],
          sources: [],
        },
      ],
    });

    expect(parsed.sections[0].summary).toBe("First point. Second point.");
  });
});
