import { describe, expect, it } from "vitest";

import {
  getDefaultProductRevenueKeys,
  getDefaultRevenueTrendKeys,
  toggleVisibleSeries,
} from "@/lib/pyth-pro/chart-visibility";

describe("revenue chart visibility", () => {
  it("defaults the trend chart to cumulative gross", () => {
    expect(getDefaultRevenueTrendKeys()).toEqual([
      "cumulativeGrossRevenueUsd",
    ]);
  });

  it("defaults the product chart to the standard disclosed revenue streams", () => {
    expect(
      getDefaultProductRevenueKeys({
        primaryProduct: "Pyth Pro",
        products: ["Pyth Pro", "LaaS", "Marketplace", "Indices"],
      })
    ).toEqual(["Pyth Pro", "LaaS", "Indices"]);
  });

  it("falls back to the first product when there is no primary revenue stream", () => {
    expect(
      getDefaultProductRevenueKeys({
        primaryProduct: null,
        products: ["New Stream", "Other Stream"],
      })
    ).toEqual(["New Stream"]);
  });

  it("toggles legend series while keeping at least one line visible", () => {
    expect(toggleVisibleSeries(["Pyth Pro"], "LaaS")).toEqual([
      "Pyth Pro",
      "LaaS",
    ]);
    expect(toggleVisibleSeries(["Pyth Pro", "LaaS"], "Pyth Pro")).toEqual([
      "LaaS",
    ]);
    expect(toggleVisibleSeries(["LaaS"], "LaaS")).toEqual(["LaaS"]);
  });
});
