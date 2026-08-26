import { afterEach, describe, expect, it, vi } from "vitest";

import { getPythPriceHistory } from "@/action/priceHistoryActions";
import { parsePythPriceHistory } from "@/lib/pyth-price-history";

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
