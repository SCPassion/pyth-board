import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRealtimePrices } from "@/action/priceActions";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function llamaCurrentPriceResponse(input: {
  solPrice: number;
  pythPrice: number;
}) {
  return {
    ok: true,
    json: async () => ({
      coins: {
        "coingecko:solana": {
          price: input.solPrice,
          symbol: "SOL",
        },
        "coingecko:pyth-network": {
          price: input.pythPrice,
          symbol: "PYTH",
        },
      },
    }),
  };
}

describe("getRealtimePrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches SOL and PYTH current and historical prices from DefiLlama", async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/prices/historical/")
          ? llamaCurrentPriceResponse({
              solPrice: 100,
              pythPrice: 0.4,
            })
          : llamaCurrentPriceResponse({
              solPrice: 110,
              pythPrice: 0.5,
            })
      )
    );

    await getRealtimePrices();

    const urls: string[] = mockFetch.mock.calls.map((call) => call[0] as string);
    expect(urls[0]).toBe(
      "https://coins.llama.fi/prices/current/coingecko:solana,coingecko:pyth-network"
    );
    expect(urls[1]).toContain(
      "https://coins.llama.fi/prices/historical/"
    );
    expect(urls[1]).toContain("coingecko:solana,coingecko:pyth-network");
    expect(mockFetch).toHaveBeenCalledWith(
      urls[0],
      expect.objectContaining({
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
    );
  });

  it("computes positive 24h change from current and historical prices", async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/prices/historical/")
          ? llamaCurrentPriceResponse({
              solPrice: 100,
              pythPrice: 0.5,
            })
          : llamaCurrentPriceResponse({
        solPrice: 110,
        pythPrice: 0.5,
            })
      )
    );

    const result = await getRealtimePrices();

    expect(result.sol.price).toBe(110);
    expect(result.sol.change24h).toBeCloseTo(10, 0);
    expect(result.pyth.price).toBe(0.5);
    expect(result.pyth.change24h).toBeCloseTo(0, 1);
  });

  it("computes negative 24h change from current and historical prices", async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/prices/historical/")
          ? llamaCurrentPriceResponse({
              solPrice: 200,
              pythPrice: 0.5,
            })
          : llamaCurrentPriceResponse({
        solPrice: 150,
              pythPrice: 0.506,
            })
      )
    );

    const result = await getRealtimePrices();

    expect(result.sol.change24h).toBeCloseTo(-25, 0);
    expect(result.pyth.change24h).toBeCloseTo(1.2, 1);
  });

  it("returns zero change when historical price is unavailable", async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/prices/historical/")
          ? llamaCurrentPriceResponse({
              solPrice: 0,
              pythPrice: 0,
            })
          : llamaCurrentPriceResponse({
        solPrice: 150,
        pythPrice: 0.5,
            })
      )
    );

    const result = await getRealtimePrices();

    expect(result.sol.change24h).toBe(0);
    expect(result.sol.price).toBeCloseTo(150);
    expect(result.pyth.change24h).toBe(0);
    expect(result.pyth.price).toBeCloseTo(0.5);
  });

  it("returns the correct price shape", async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("/prices/historical/")
          ? llamaCurrentPriceResponse({
              solPrice: 100,
              pythPrice: 0.4,
            })
          : llamaCurrentPriceResponse({
        solPrice: 150,
        pythPrice: 0.5,
            })
      )
    );

    const result = await getRealtimePrices();

    expect(result.sol).toMatchObject({
      symbol: "SOL",
      price: expect.any(Number),
      change24h: expect.any(Number),
      change24hValue: expect.any(Number),
    });
    expect(result.pyth).toMatchObject({
      symbol: "PYTH",
      price: expect.any(Number),
      change24h: expect.any(Number),
      change24hValue: expect.any(Number),
    });
  });
});
