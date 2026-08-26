import { describe, expect, it, vi } from "vitest";

import { getPythPriceHistory } from "@/action/priceHistoryActions";

describe("getPythPriceHistory", () => {
  it("fetches and maps the 24h PYTH chart server-side", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        coins: {
          "coingecko:pyth-network": {
            symbol: "PYTH",
            confidence: 0.99,
            prices: [
              { timestamp: 1_780_000_000, price: 0.049 },
              { timestamp: 1_779_996_400, price: 0.047 },
            ],
          },
        },
      }),
    });

    const points = await getPythPriceHistory({
      nowSeconds: 1_780_000_090,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://coins.llama.fi/chart/coingecko:pyth-network?start=1779913600&period=1h&span=24",
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
});
