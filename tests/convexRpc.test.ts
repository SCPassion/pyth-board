import { afterEach, describe, expect, it, vi } from "vitest";

const { connection } = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock("@solana/web3.js", () => ({
  Connection: class {
    constructor(endpoint: string) {
      connection(endpoint);
      throw new Error("RPC unavailable");
    }
  },
  PublicKey: class {},
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

const fallbacks = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-api.projectserum.com",
];

describe.each([
  ["reserveSnapshots", "runPythHoldingSnapshotJob"],
  ["pythBuybackSnapshots", "runPythBuybackSnapshotJob"],
])("Convex %s RPC configuration", (moduleName, jobName) => {
  it.each(["https://configured-rpc.example", undefined, ""])(
    "uses the configured primary and preserves fallback order (%s)",
    async (primary) => {
      vi.stubEnv("PRIMARY_SOLANA_RPC_URL", primary);
      const module = await import(`../convex/${moduleName}.ts`);
      await expect(module[jobName]._handler({})).rejects.toThrow();
      expect(connection.mock.calls.map(([endpoint]) => endpoint)).toEqual(
        primary ? [primary, ...fallbacks] : fallbacks,
      );
    },
  );
});
