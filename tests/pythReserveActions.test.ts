import { beforeEach, describe, expect, it, vi } from "vitest";

import { getReserveAssetPrices } from "@/action/pythReserveActions";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("getReserveAssetPrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses DefiLlama current prices so reserve PYTH holdings have USD value", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        coins: {
          "coingecko:solana": {
            price: 96.93,
            symbol: "SOL",
            timestamp: 1787768080,
            confidence: 0.99,
          },
          "coingecko:pyth-network": {
            price: 0.0488,
            symbol: "PYTH",
            timestamp: 1787768080,
            confidence: 0.99,
          },
        },
      }),
    });

    const prices = await getReserveAssetPrices();

    expect(prices).toEqual({
      pythPrice: 0.0488,
      solPrice: 96.93,
      usdcPrice: 1,
      usdtPrice: 1,
    });
  });
});
