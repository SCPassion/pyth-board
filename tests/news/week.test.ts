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
