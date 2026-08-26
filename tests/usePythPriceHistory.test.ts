import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPythPriceHistory } from "@/hooks/use-pyth-price-history";

describe("fetchPythPriceHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps DefiLlama hourly chart prices into sorted 24h chart points", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        coins: {
          "coingecko:pyth-network": {
            prices: [
              { timestamp: 1_780_000_000, price: 0.049 },
              { timestamp: 1_779_996_400, price: 0.047 },
            ],
          },
        },
      }),
    });

    const points = await fetchPythPriceHistory({
      fromTimestamp: 1_779_996_000,
      toTimestamp: 1_780_000_000,
      fetcher,
      signal: new AbortController().signal,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://coins.llama.fi/chart/coingecko:pyth-network?start=1779996000&period=1h&span=24",
      expect.objectContaining({
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
    );
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
    const points = await fetchPythPriceHistory({
      fromTimestamp: 1_779_996_000,
      toTimestamp: 1_780_000_000,
      fetcher: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      signal: new AbortController().signal,
    });

    expect(points).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
