import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPythPrice } from "@/hooks/use-pyth-price";

describe("fetchPythPrice", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not log noisy console errors when the browser fetch fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const price = await fetchPythPrice({ fetcher, timeoutMs: 1_000 });

    expect(price).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("fetches the PYTH price from CoinGecko simple price", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "pyth-network": {
          usd: 0.12345,
        },
      }),
    });

    const price = await fetchPythPrice({ fetcher, timeoutMs: 1_000 });

    expect(price).toBe(0.12345);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.coingecko.com/api/v3/simple/price?ids=pyth-network&vs_currencies=usd",
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
      })
    );
  });
});
