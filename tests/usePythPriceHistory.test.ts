import { afterEach, describe, expect, it, vi } from "vitest";

import { getPythPriceHistory } from "@/action/priceHistoryActions";
import { getPriceChange, parsePythPriceHistory } from "@/lib/pyth-price-history";

describe("PYTH price history mapping", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps DefiLlama hourly chart prices into sorted 24h chart points", async () => {
    const points = parsePythPriceHistory({
      coins: {
        "coingecko:pyth-network": {
          prices: [
            { timestamp: 1_780_000_000, price: 0.049 },
            { timestamp: 1_779_996_400, price: 0.047 },
          ],
        },
      },
    });

    expect(points).toEqual([
      {
        label: expect.any(String),
        price: 0.047,
        timestamp: 1_779_996_400,
        tooltipLabel: expect.any(String),
      },
      {
        label: expect.any(String),
        price: 0.049,
        timestamp: 1_780_000_000,
        tooltipLabel: expect.any(String),
      },
    ]);
  });

  it("returns an empty curve without console noise when the chart fetch fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const points = await getPythPriceHistory({
      nowSeconds: 1_780_000_090,
      fetcher: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    });

    expect(points).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("getPriceChange", () => {
  const point = (timestamp: number, price: number) => ({
    label: "",
    tooltipLabel: "",
    timestamp,
    price,
  });

  it("needs at least two history points", () => {
    expect(getPriceChange([], 0.05)).toBeNull();
    expect(getPriceChange([point(1, 0.05)], 0.06)).toBeNull();
  });

  it("measures from the first point to the live price when available", () => {
    expect(getPriceChange([point(1, 0.04), point(2, 0.045)], 0.05)).toEqual({
      startPrice: 0.04,
      endPrice: 0.05,
      changePct: expect.closeTo(25, 6),
    });
  });

  it("falls back to the last history point without a live price", () => {
    expect(
      getPriceChange([point(1, 0.05), point(2, 0.04)], null)?.changePct
    ).toBeCloseTo(-20, 6);
  });
});
