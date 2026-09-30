import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import type { Position } from "@pythnetwork/staking-sdk";

const mocks = vi.hoisted(() => ({
  accounts: vi.fn(), positions: vi.fn(), target: vi.fn(), clock: vi.fn(), constructor: vi.fn(),
}));
vi.mock("@pythnetwork/staking-sdk", async () => {
  const { createRequire } = await import("node:module");
  const actual = createRequire(import.meta.url)("@pythnetwork/staking-sdk") as typeof import("@pythnetwork/staking-sdk");
  return { ...actual, PythStakingClient: function (config: { connection: unknown }) {
    mocks.constructor(config);
    return { connection: config.connection, getAllStakeAccountPositions: mocks.accounts,
      getStakeAccountPositions: mocks.positions, getTargetAccount: mocks.target };
  } };
});
vi.mock("@solana/web3.js", async importOriginal => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return { ...actual, Connection: class {
    constructor(public rpcEndpoint: string) {}
    getAccountInfo = mocks.clock;
  } };
});

import { getGovernanceStakingInfo, refreshGovernanceStakingInfo, getGovernanceTotalStaked } from "@/action/pythActions";
const OWNER = PublicKey.default;
const ACCOUNT = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SECOND_ACCOUNT = new PublicKey("So11111111111111111111111111111111111111112");
const position = (amount: number, activationEpoch = 9n, unlockingStart: bigint | null = null, ois = false): Position => ({
  amount: BigInt(amount) * 1_000_000n, activationEpoch, unlockingStart,
  targetWithParameters: ois ? { integrityPool: { publisher: OWNER } } : { voting: {} },
});
const mixedPositions = () => [position(100), position(20, 11n), position(30, 9n, 11n),
  position(40, 9n, 10n), position(90, 9n, 9n), position(500, 9n, null, true)];
function setEpoch(epoch: bigint) {
  const data = Buffer.alloc(40); data.writeBigInt64LE(epoch * 604800n, 32);
  mocks.clock.mockResolvedValue({ data });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PRIMARY_SOLANA_RPC_URL", "https://mock-primary.example");
  mocks.accounts.mockResolvedValue([ACCOUNT]);
  mocks.positions.mockResolvedValue({ address: ACCOUNT, data: { owner: OWNER, positions: mixedPositions() } });
  setEpoch(10n);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("governance wallet actions", () => {
  it("counts governance states without OIS, unlocked balances, or reward reads", async () => {
    const result = await getGovernanceStakingInfo(OWNER.toBase58());
    expect(result.info).toMatchObject({ kind: "governance", totalStakedPyth: 190,
      activePyth: 100, warmingUpPyth: 20, unstakingPyth: 70 });
    expect(result.stakingAddress).toBe(ACCOUNT.toBase58());
    expect(mocks.accounts).toHaveBeenCalledWith(OWNER);
    // The SDK mock exposes only governance reads: any OIS/reward call would fail.
    expect(result.info).not.toHaveProperty("claimableRewards");
    expect(result.info).not.toHaveProperty("StakeForEachPublisher");
  });

  it("adds all owned accounts without counting duplicate discovery results twice", async () => {
    mocks.accounts.mockResolvedValue([ACCOUNT, SECOND_ACCOUNT, ACCOUNT]);
    mocks.positions.mockImplementation(async (address: PublicKey) => ({ address, data: {
      owner: OWNER, positions: address.equals(ACCOUNT) ? mixedPositions() : [position(11)],
    } }));
    const result = await getGovernanceStakingInfo(OWNER.toBase58());
    expect(result.info.totalStakedPyth).toBe(201);
    expect(result.info.activePyth).toBe(111);
    expect(result.info.stakingAccounts).toHaveLength(2);
    expect(mocks.positions).toHaveBeenCalledTimes(2);
  });

  it.each([[11n, 150, 120, 30], [12n, 120, 120, 0]])(
    "updates warmup and cooldown at epoch %s", async (epoch, total, active, unstaking) => {
      setEpoch(epoch);
      const result = await getGovernanceStakingInfo(OWNER.toBase58());
      expect(result.info).toMatchObject({ totalStakedPyth: total, activePyth: active, warmingUpPyth: 0, unstakingPyth: unstaking });
    });

  it("allows a wallet with no staking accounts and reports a genuine zero", async () => {
    mocks.accounts.mockResolvedValue([]);
    const result = await getGovernanceStakingInfo(OWNER.toBase58());
    expect(result.info.totalStakedPyth).toBe(0);
    expect(result.info.stakingAccounts).toEqual([]);
    expect(result.stakingAddress).toBe("");
  });

  it("reports zero governance stake for an OIS-only account", async () => {
    mocks.positions.mockResolvedValue({ address: ACCOUNT, data: { owner: OWNER, positions: [position(500, 9n, null, true)] } });
    expect((await getGovernanceStakingInfo(OWNER.toBase58())).info.totalStakedPyth).toBe(0);
  });

  it.each(["", "invalid-address"])("rejects invalid input %s without RPC calls", async address => {
    await expect(getGovernanceStakingInfo(address)).rejects.toThrow(address ? "Invalid wallet address" : "Wallet address is required");
    expect(mocks.constructor).not.toHaveBeenCalled();
  });

  it("falls back to the public endpoint on discovery failure", async () => {
    mocks.accounts.mockRejectedValueOnce(new Error("429"));
    expect((await getGovernanceStakingInfo(OWNER.toBase58())).info.totalStakedPyth).toBe(190);
    expect(mocks.constructor.mock.calls.map(([config]) => config.connection.rpcEndpoint)).toEqual([
      "https://mock-primary.example", "https://api.mainnet-beta.solana.com",
    ]);
  });

  it("falls back on a hung primary RPC", async () => {
    vi.useFakeTimers();
    mocks.accounts.mockImplementationOnce(() => new Promise(() => {}));
    const read = getGovernanceStakingInfo(OWNER.toBase58());
    await vi.advanceTimersByTimeAsync(10000);
    expect((await read).info.totalStakedPyth).toBe(190);
  });

  it("fails instead of returning a partial total when one account cannot be read", async () => {
    mocks.accounts.mockResolvedValue([ACCOUNT, SECOND_ACCOUNT]);
    mocks.positions.mockImplementation(async address => {
      if (address.equals(SECOND_ACCOUNT)) throw new Error("Account unavailable");
      return { address, data: { owner: OWNER, positions: mixedPositions() } };
    });
    await expect(getGovernanceStakingInfo(OWNER.toBase58())).rejects.toThrow("Unable to load governance balances");
  });

  it("rejects a staking account owned by another wallet", async () => {
    mocks.positions.mockResolvedValue({ address: ACCOUNT, data: { owner: SECOND_ACCOUNT, positions: mixedPositions() } });
    await expect(getGovernanceStakingInfo(OWNER.toBase58())).rejects.toThrow("Unable to load governance balances");
  });

  it("fails when the chain clock cannot be read", async () => {
    mocks.clock.mockResolvedValue(null);
    await expect(getGovernanceStakingInfo(OWNER.toBase58())).rejects.toThrow("Unable to load governance balances");
  });

  it("rediscovers accounts when refreshing an existing wallet", async () => {
    const result = await refreshGovernanceStakingInfo(OWNER.toBase58());
    expect(result.info.totalStakedPyth).toBe(190);
    expect(mocks.accounts).toHaveBeenCalledWith(OWNER);
  });
});

describe("network governance total", () => {
  it("reads the global target without discovering wallets", async () => {
    mocks.target.mockResolvedValue({ locked: 1_250_000_000_000_000n, deltaLocked: -50_000_000_000_000n });
    expect(await getGovernanceTotalStaked()).toBe(1_200_000_000);
    expect(mocks.accounts).not.toHaveBeenCalled();
    expect(mocks.positions).not.toHaveBeenCalled();
  });
  it("falls back when the primary RPC fails", async () => {
    mocks.target.mockRejectedValueOnce(new Error("RPC unavailable"))
      .mockResolvedValueOnce({ locked: 10_000_000n, deltaLocked: 0n });
    expect(await getGovernanceTotalStaked()).toBe(10);
  });
  it("falls back after a primary RPC timeout", async () => {
    vi.useFakeTimers();
    mocks.target.mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ locked: 12_000_000n, deltaLocked: 0n });
    const read = getGovernanceTotalStaked();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await read).toBe(12);
  });
  it("returns unavailable instead of zero when all RPCs fail", async () => {
    mocks.target.mockRejectedValue(new Error("RPC unavailable"));
    expect(await getGovernanceTotalStaked()).toBeNull();
  });
  it("accepts a genuine zero", async () => {
    mocks.target.mockResolvedValue({ locked: 0n, deltaLocked: 0n });
    expect(await getGovernanceTotalStaked()).toBe(0);
  });
  it("rejects invalid negative totals", async () => {
    mocks.target.mockResolvedValue({ locked: 1n, deltaLocked: -2n });
    expect(await getGovernanceTotalStaked()).toBeNull();
  });
});
