import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublicKey } from "@solana/web3.js";

// ─── Hoisted mocks (available inside vi.mock factories) ──────────────────────

const {
  mockClient,
  mockClients,
  mockExtractPublisherData,
  MockPythStakingClient,
} =
  vi.hoisted(() => {
    const createMockClient = () => ({
      getMainStakeAccount: vi.fn(),
      getClaimableRewards: vi.fn(),
      getStakeAccountPositions: vi.fn(),
      getTargetAccount: vi.fn(),
      getPoolDataAccount: vi.fn(),
      getRewardCustodyAccount: vi.fn(),
      wallet: { publicKey: null as unknown as PublicKey },
      connection: {},
    });

    const mockClient = createMockClient();
    const mockClients: ReturnType<typeof createMockClient>[] = [];

    // Regular function so `new PythStakingClient(...)` works in production code
    function MockPythStakingClient(this: unknown) {
      return mockClients.shift() ?? mockClient;
    }

    return {
      mockClient,
      mockClients,
      mockExtractPublisherData: vi.fn(),
      MockPythStakingClient,
    };
  });

vi.mock("@pythnetwork/staking-sdk", () => ({
  PythStakingClient: MockPythStakingClient,
  extractPublisherData: mockExtractPublisherData,
}));

// Keep real PublicKey for address validation; only stub Connection
vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return { ...actual, Connection: class MockConnection {} };
});

// ─── Test fixtures ────────────────────────────────────────────────────────────

const WALLET_ADDRESS = "11111111111111111111111111111111"; // system program — valid 32-byte key
const STAKING_ADDRESS = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function makePoolData() {
  return {
    delState: [{ totalDelegation: 500_000_000n, deltaDelegation: 0n }],
    selfDelState: [{ totalDelegation: 100_000_000n, deltaDelegation: 0n }],
    claimableRewards: 5_000_000n,
    publishers: [],
  };
}

function setupHappyPath() {
  const stakingPubkey = new PublicKey(STAKING_ADDRESS);

  mockClient.getMainStakeAccount.mockResolvedValue({
    stakeAccountPosition: stakingPubkey,
  });

  mockClient.getClaimableRewards.mockResolvedValue({ totalRewards: 1_000_000n }); // 1 PYTH

  mockClient.getStakeAccountPositions.mockResolvedValue({
    address: stakingPubkey,
    data: {
      owner: new PublicKey(WALLET_ADDRESS),
      positions: [
        {
          amount: 500_000_000n, // 500 PYTH
          targetWithParameters: {
            integrityPool: { publisher: new PublicKey(WALLET_ADDRESS) },
          },
        },
      ],
    },
  });

  const poolData = makePoolData();
  mockClient.getPoolDataAccount.mockResolvedValue(poolData);
  mockClient.getTargetAccount.mockResolvedValue({
    locked: 10_000_000_000n,
    deltaLocked: 0n,
  });
  mockClient.getRewardCustodyAccount.mockResolvedValue({
    amount: 55_000_000n,
  });

  mockExtractPublisherData.mockReturnValue([
    {
      totalDelegation: 500_000_000n,
      totalDelegationDelta: 0n,
      pubkey: new PublicKey(WALLET_ADDRESS),
      apyHistory: [{ apy: 0.08 }],
    },
  ]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

import { getOISStakingInfo, refreshOISStakingInfo } from "@/action/pythActions";

describe("getOISStakingInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClients.length = 0;
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it("throws if wallet address is empty", async () => {
    await expect(getOISStakingInfo("")).rejects.toThrow(
      "Wallet address is required"
    );
  });

  it("throws if wallet address format is invalid", async () => {
    await expect(getOISStakingInfo("not-a-valid-solana-address")).rejects.toThrow(
      "Invalid wallet address format"
    );
  });

  // ── Account discovery ───────────────────────────────────────────────────────

  it("throws a clear error when no staking account exists for the wallet", async () => {
    mockClient.getMainStakeAccount.mockResolvedValue(undefined);

    await expect(getOISStakingInfo(WALLET_ADDRESS)).rejects.toThrow(
      "No staking account found for this wallet"
    );
  });

  it("calls getMainStakeAccount with the wallet public key to discover the staking account", async () => {
    setupHappyPath();

    await getOISStakingInfo(WALLET_ADDRESS);

    expect(mockClient.getMainStakeAccount).toHaveBeenCalledWith(
      expect.objectContaining({ toBase58: expect.any(Function) })
    );
    const calledWith: PublicKey = mockClient.getMainStakeAccount.mock.calls[0][0];
    expect(calledWith.toBase58()).toBe(WALLET_ADDRESS);
  });

  it("queries each RPC endpoint at most once during stake account discovery", async () => {
    const stakingPubkey = new PublicKey(STAKING_ADDRESS);
    const clients = Array.from({ length: 4 }, () => ({
      getMainStakeAccount: vi.fn().mockResolvedValue({
        stakeAccountPosition: stakingPubkey,
      }),
      getClaimableRewards: vi.fn().mockResolvedValue({ totalRewards: 1_000_000n }),
      getStakeAccountPositions: vi.fn().mockResolvedValue({
        address: stakingPubkey,
        data: {
          owner: new PublicKey(WALLET_ADDRESS),
          positions: [],
        },
      }),
      getTargetAccount: vi.fn().mockResolvedValue({
        locked: 10_000_000_000n,
        deltaLocked: 0n,
      }),
      getPoolDataAccount: vi.fn().mockResolvedValue(makePoolData()),
      getRewardCustodyAccount: vi.fn().mockResolvedValue({
        amount: 55_000_000n,
      }),
      wallet: { publicKey: null as unknown as PublicKey },
      connection: {},
    }));

    mockExtractPublisherData.mockReturnValue([]);
    mockClients.push(...clients);

    await getOISStakingInfo(WALLET_ADDRESS);

    clients.forEach((client) => {
      expect(client.getMainStakeAccount).toHaveBeenCalledTimes(1);
    });
  });

  it("falls back quickly to a responsive RPC when an earlier endpoint hangs", async () => {
    const stakingPubkey = new PublicKey(STAKING_ADDRESS);
    const slowClient = {
      getMainStakeAccount: vi.fn(
        () => new Promise(() => undefined) as Promise<never>
      ),
      getClaimableRewards: vi.fn(),
      getStakeAccountPositions: vi.fn(),
      getTargetAccount: vi.fn(),
      getPoolDataAccount: vi.fn(),
      getRewardCustodyAccount: vi.fn(),
      wallet: { publicKey: null as unknown as PublicKey },
      connection: {},
    };

    const fastClient = {
      getMainStakeAccount: vi.fn().mockResolvedValue({
        stakeAccountPosition: stakingPubkey,
      }),
      getClaimableRewards: vi.fn().mockResolvedValue({ totalRewards: 1_000_000n }),
      getStakeAccountPositions: vi.fn().mockResolvedValue({
        address: stakingPubkey,
        data: {
          owner: new PublicKey(WALLET_ADDRESS),
          positions: [],
        },
      }),
      getTargetAccount: vi.fn().mockResolvedValue({
        locked: 10_000_000_000n,
        deltaLocked: 0n,
      }),
      getPoolDataAccount: vi.fn().mockResolvedValue(makePoolData()),
      getRewardCustodyAccount: vi.fn().mockResolvedValue({
        amount: 55_000_000n,
      }),
      wallet: { publicKey: null as unknown as PublicKey },
      connection: {},
    };

    mockExtractPublisherData.mockReturnValue([]);
    mockClients.push(slowClient, fastClient);

    const result = await getOISStakingInfo(WALLET_ADDRESS);

    expect(result.stakingAddress).toBe(STAKING_ADDRESS);
    expect(fastClient.getMainStakeAccount).toHaveBeenCalledTimes(1);
  });

  // ── Return shape ────────────────────────────────────────────────────────────

  it("returns the auto-discovered staking address as a base58 string", async () => {
    setupHappyPath();

    const result = await getOISStakingInfo(WALLET_ADDRESS);

    expect(result.stakingAddress).toBe(STAKING_ADDRESS);
  });

  it("returns staking info with expected shape", async () => {
    setupHappyPath();

    const result = await getOISStakingInfo(WALLET_ADDRESS);

    expect(result.info).toMatchObject({
      totalStakedPyth: expect.any(Number),
      claimableRewards: expect.any(Number),
      StakeForEachPublisher: expect.any(Array),
      generalStats: expect.objectContaining({
        totalGovernance: expect.any(Number),
        totalStaked: expect.any(Number),
        rewardsDistributed: expect.any(Number),
      }),
    });
  });

  it("returns correct totalStakedPyth from positions", async () => {
    setupHappyPath();

    const result = await getOISStakingInfo(WALLET_ADDRESS);

    // 500_000_000 raw * 1e-6 = 500 PYTH
    expect(result.info.totalStakedPyth).toBeCloseTo(500);
  });

  it("returns correct claimableRewards from SDK", async () => {
    setupHappyPath();

    const result = await getOISStakingInfo(WALLET_ADDRESS);

    // 1_000_000 raw * 1e-6 = 1 PYTH
    expect(result.info.claimableRewards).toBeCloseTo(1);
  });
});

describe("refreshOISStakingInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClients.length = 0;
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it("throws if wallet address is empty", async () => {
    await expect(refreshOISStakingInfo("", STAKING_ADDRESS)).rejects.toThrow(
      "Wallet address is required"
    );
  });

  it("throws if staking address is empty", async () => {
    await expect(refreshOISStakingInfo(WALLET_ADDRESS, "")).rejects.toThrow(
      "Staking address is required"
    );
  });

  it("throws if wallet address format is invalid", async () => {
    await expect(
      refreshOISStakingInfo("not-a-valid-address", STAKING_ADDRESS)
    ).rejects.toThrow("Invalid wallet address format");
  });

  it("throws if staking address format is invalid", async () => {
    await expect(
      refreshOISStakingInfo(WALLET_ADDRESS, "not-a-valid-address")
    ).rejects.toThrow("Invalid staking address format");
  });

  // ── No discovery ────────────────────────────────────────────────────────────

  it("does not call getMainStakeAccount — uses the known staking address directly", async () => {
    setupHappyPath();

    await refreshOISStakingInfo(WALLET_ADDRESS, STAKING_ADDRESS);

    expect(mockClient.getMainStakeAccount).not.toHaveBeenCalled();
  });

  it("uses the primary refresh client when it is healthy without probing fallback RPCs", async () => {
    const stakingPubkey = new PublicKey(STAKING_ADDRESS);
    const primaryClient = {
      getMainStakeAccount: vi.fn(),
      getClaimableRewards: vi.fn().mockResolvedValue({ totalRewards: 1_000_000n }),
      getStakeAccountPositions: vi.fn().mockResolvedValue({
        address: stakingPubkey,
        data: {
          owner: new PublicKey(WALLET_ADDRESS),
          positions: [],
        },
      }),
      getTargetAccount: vi.fn().mockResolvedValue({
        locked: 10_000_000_000n,
        deltaLocked: 0n,
      }),
      getPoolDataAccount: vi.fn().mockResolvedValue(makePoolData()),
      getRewardCustodyAccount: vi.fn().mockResolvedValue({
        amount: 55_000_000n,
      }),
      wallet: { publicKey: null as unknown as PublicKey },
      connection: {},
    };

    const fallbackClient = {
      getMainStakeAccount: vi.fn(),
      getClaimableRewards: vi.fn(),
      getStakeAccountPositions: vi.fn(),
      getTargetAccount: vi.fn(),
      getPoolDataAccount: vi.fn(),
      getRewardCustodyAccount: vi.fn(),
      wallet: { publicKey: null as unknown as PublicKey },
      connection: {},
    };

    mockExtractPublisherData.mockReturnValue([]);
    mockClients.push(primaryClient, fallbackClient);

    const result = await refreshOISStakingInfo(
      WALLET_ADDRESS,
      STAKING_ADDRESS
    );

    expect(result.stakingAddress).toBe(STAKING_ADDRESS);
    expect(primaryClient.getTargetAccount).toHaveBeenCalledTimes(1);
    expect(fallbackClient.getTargetAccount).not.toHaveBeenCalled();
    expect(fallbackClient.getStakeAccountPositions).not.toHaveBeenCalled();
  });

  // ── Return shape ────────────────────────────────────────────────────────────

  it("returns the provided staking address unchanged", async () => {
    setupHappyPath();

    const result = await refreshOISStakingInfo(WALLET_ADDRESS, STAKING_ADDRESS);

    expect(result.stakingAddress).toBe(STAKING_ADDRESS);
  });

  it("returns staking info with expected shape", async () => {
    setupHappyPath();

    const result = await refreshOISStakingInfo(WALLET_ADDRESS, STAKING_ADDRESS);

    expect(result.info).toMatchObject({
      totalStakedPyth: expect.any(Number),
      claimableRewards: expect.any(Number),
      StakeForEachPublisher: expect.any(Array),
      generalStats: expect.objectContaining({
        totalGovernance: expect.any(Number),
        totalStaked: expect.any(Number),
        rewardsDistributed: expect.any(Number),
      }),
    });
  });

  it("returns correct totalStakedPyth from positions", async () => {
    setupHappyPath();

    const result = await refreshOISStakingInfo(WALLET_ADDRESS, STAKING_ADDRESS);

    expect(result.info.totalStakedPyth).toBeCloseTo(500);
  });

  it("returns correct claimableRewards", async () => {
    setupHappyPath();

    const result = await refreshOISStakingInfo(WALLET_ADDRESS, STAKING_ADDRESS);

    expect(result.info.claimableRewards).toBeCloseTo(1);
  });
});
