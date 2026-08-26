import { describe, expect, it } from "vitest";

import { selectChangedDouroTopics } from "@/lib/pyth-pro/sync";

describe("selectChangedDouroTopics", () => {
  it("returns only Douro report topics that are new or changed", () => {
    const changed = selectChangedDouroTopics(
      [
        {
          id: 2660,
          slug: "pyth-pro-douro-labs-report-july-2026",
          title: "Pyth Pro: Douro Labs Report - July 2026",
          created_at: "2026-08-04T00:00:00.000Z",
          last_posted_at: "2026-08-04T00:00:00.000Z",
          highest_post_number: 1,
        },
        {
          id: 2627,
          slug: "pyth-pro-douro-labs-report-june-2026",
          title: "Pyth Pro: Douro Labs Report - June 2026",
          created_at: "2026-07-03T00:00:00.000Z",
          last_posted_at: "2026-07-03T00:00:00.000Z",
          highest_post_number: 1,
        },
        {
          id: 777,
          slug: "about-the-pyth-pro-category",
          title: "About the Pyth Pro category",
          created_at: "2025-12-01T00:00:00.000Z",
          last_posted_at: "2025-12-01T00:00:00.000Z",
          highest_post_number: 1,
        },
      ],
      new Map([
        [
          2627,
          {
            lastPostedAtMs: Date.parse("2026-07-03T00:00:00.000Z"),
            highestPostNumber: 1,
          },
        ],
      ])
    );

    expect(changed.map((topic) => topic.id)).toEqual([2660]);
  });

  it("can force all Douro report topics for a repair backfill", () => {
    const changed = selectChangedDouroTopics(
      [
        {
          id: 2627,
          slug: "pyth-pro-douro-labs-report-june-2026",
          title: "Pyth Pro: Douro Labs Report - June 2026",
          created_at: "2026-07-03T00:00:00.000Z",
          last_posted_at: "2026-07-03T00:00:00.000Z",
          highest_post_number: 1,
        },
      ],
      new Map([
        [
          2627,
          {
            lastPostedAtMs: Date.parse("2026-07-03T00:00:00.000Z"),
            highestPostNumber: 1,
          },
        ],
      ]),
      { force: true }
    );

    expect(changed.map((topic) => topic.id)).toEqual([2627]);
  });
});
