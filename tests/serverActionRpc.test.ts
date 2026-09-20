import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { endpoints, failPrimary } = vi.hoisted(() => ({
  endpoints: [] as string[],
  failPrimary: { value: false },
}));
vi.mock("@solana/web3.js", () => ({
  PublicKey: class {},
  Connection: class {
    constructor(private endpoint: string) { endpoints.push(endpoint); }
    async getBalance() {
      if (failPrimary.value && this.endpoint === "https://swap-rpc.example") {
        throw new Error("Primary unavailable");
      }
      return 0;
    }
    async getParsedTokenAccountsByOwner() { return { value: [] }; }
    async getSignaturesForAddress() {
      await this.getBalance();
      return [];
    }
  },
}));

beforeEach(() => {
  endpoints.length = 0;
  failPrimary.value = false;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ coins: {} }),
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const actions = [
  ["reserve", async () => (await import("../action/pythReserveActions")).getPythReserveSummary()],
  ["swaps", async () => (await import("../action/swapTransactionsActions")).getSwapTransactionsPage(1, 10)],
] as const;

describe.each(actions)("%s RPC", (_name, run) => {
  it.each(["https://swap-rpc.example", undefined, ""])("selects SWAP_SOLANA_RPC_URL (%s)", async (primary) => {
    vi.stubEnv("SWAP_SOLANA_RPC_URL", primary);
    await run();
    expect([...new Set(endpoints)]).toEqual([primary || "https://api.mainnet-beta.solana.com"]);
  });
  it("falls back when the configured primary fails", async () => {
    vi.stubEnv("SWAP_SOLANA_RPC_URL", "https://swap-rpc.example");
    failPrimary.value = true;
    await run();
    expect([...new Set(endpoints)]).toEqual([
      "https://swap-rpc.example", "https://api.mainnet-beta.solana.com",
    ]);
  });
});
