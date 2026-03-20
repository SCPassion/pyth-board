import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock global fetch ────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hermesLatestResponse(price: number) {
  return {
    ok: true,
    json: async () => ({
      parsed: [{ price: { price: String(Math.round(price * 1e8)), expo: -8 } }],
    }),
  };
}

function hermesHistoricalResponse(price: number) {
  return hermesLatestResponse(price);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

import { getRealtimePrices } from "@/action/priceActions";

describe("getRealtimePrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never calls CoinGecko", async () => {
    // Return valid Hermes responses for all 4 calls (2 latest + 2 historical)
    mockFetch.mockResolvedValue(hermesLatestResponse(150));

    await getRealtimePrices();

    const urls: string[] = mockFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.every((u) => !u.includes("coingecko"))).toBe(true);
  });

  it("fetches both latest and 24h-ago prices from Hermes for each asset", async () => {
    mockFetch.mockResolvedValue(hermesLatestResponse(150));

    await getRealtimePrices();

    const urls: string[] = mockFetch.mock.calls.map((c) => c[0] as string);
    const latestCalls = urls.filter((u) => u.includes("/price/latest"));
    const historicalCalls = urls.filter((u) => !u.includes("/price/latest"));

    expect(latestCalls.length).toBeGreaterThanOrEqual(2); // SOL + PYTH latest
    expect(historicalCalls.length).toBeGreaterThanOrEqual(2); // SOL + PYTH 24h ago
  });

  it("computes positive 24h change correctly", async () => {
    // SOL: was $100, now $110 → +10%
    // PYTH: was $0.50, now $0.50 → 0%
    let callCount = 0;
    mockFetch.mockImplementation((url: string) => {
      callCount++;
      // latest calls come first in Promise.all, then historical
      // We'll key off call order: 1=SOL latest, 2=PYTH latest, 3=SOL 24h, 4=PYTH 24h
      if (url.includes("/price/latest")) {
        return Promise.resolve(
          url.includes("ef0d8b6f")
            ? hermesLatestResponse(110) // SOL now
            : hermesLatestResponse(0.5) // PYTH now
        );
      } else {
        return Promise.resolve(
          url.includes("ef0d8b6f")
            ? hermesHistoricalResponse(100) // SOL 24h ago
            : hermesHistoricalResponse(0.5) // PYTH 24h ago
        );
      }
    });

    const result = await getRealtimePrices();

    expect(result.sol.change24h).toBeCloseTo(10, 0); // ~10%
    expect(result.pyth.change24h).toBeCloseTo(0, 1);
  });

  it("computes negative 24h change correctly", async () => {
    // SOL: was $200, now $150 → -25%
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/price/latest")) {
        return Promise.resolve(
          url.includes("ef0d8b6f")
            ? hermesLatestResponse(150)
            : hermesLatestResponse(0.5)
        );
      } else {
        return Promise.resolve(
          url.includes("ef0d8b6f")
            ? hermesHistoricalResponse(200)
            : hermesHistoricalResponse(0.5)
        );
      }
    });

    const result = await getRealtimePrices();

    expect(result.sol.change24h).toBeCloseTo(-25, 0);
  });

  it("returns zero change when historical price is unavailable", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/price/latest")) {
        return Promise.resolve(hermesLatestResponse(150));
      }
      // historical fetch fails
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    const result = await getRealtimePrices();

    expect(result.sol.change24h).toBe(0);
    expect(result.sol.price).toBeCloseTo(150);
  });

  it("returns the correct price shape", async () => {
    mockFetch.mockResolvedValue(hermesLatestResponse(150));

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
