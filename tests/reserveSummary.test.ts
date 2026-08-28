import { describe, expect, it } from "vitest";

import { formatPythSupplyShare } from "@/components/reserve-summary";

describe("formatPythSupplyShare", () => {
  it("formats PYTH reserve holdings as a percentage of total supply", () => {
    expect(formatPythSupplyShare(38_250_000)).toBe("0.383%");
  });
});
