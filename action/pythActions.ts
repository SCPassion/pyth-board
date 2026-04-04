"use server";

import type {
  MyPublisherInfo,
  PythGeneralStats,
  PythStakingInfo,
} from "@/types/pythTypes";
import {
  extractPublisherData,
  PythStakingClient,
} from "@pythnetwork/staking-sdk";
import { PublicKey, Connection } from "@solana/web3.js";

const INITIAL_REWARD_POOL_SIZE = 60_000_000_000_000n;
const STAKE_ACCOUNT_DISCOVERY_TIMEOUT_MS = 10000;

// RPC endpoints with fallback support.
// Alchemy (paid) is tried first; public endpoints are fallbacks.
// The Alchemy URL is read from an env var to keep the API key out of source.
const buildRpcEndpoints = (): string[] => {
  const endpoints: string[] = [];
  if (process.env.PRIMARY_SOLANA_RPC_URL) {
    endpoints.push(process.env.PRIMARY_SOLANA_RPC_URL);
  }
  // Hard-coded public fallback ensures we always have at least one option.
  const defaults = [
    "https://api.mainnet-beta.solana.com",
  ];
  for (const url of defaults) {
    if (!endpoints.includes(url)) endpoints.push(url);
  }
  return endpoints;
};

const RPC_ENDPOINTS = buildRpcEndpoints();

// Connection configuration for better performance.
// disableRetryOnRateLimit: true — we handle 429 fallback ourselves; the SDK's
// built-in exponential backoff causes 20-30s hangs when an endpoint rate-limits.
const CONNECTION_CONFIG = {
  commitment: "confirmed" as const,
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: true,
  httpHeaders: {
    "User-Agent": "PythBoard/1.0",
  },
};

/**
 * Validates Solana public key format
 * @param {string} address - The address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches the 5 raw data payloads needed to build PythStakingInfo.
 * Extracted so callers can retry with a different client on 429.
 */
async function fetchStakingData(client: PythStakingClient, stakeAccount: PublicKey) {
  return Promise.all([
    getClaimableRewards(client, stakeAccount).catch(() => ({ totalRewards: 0n })),
    client.getStakeAccountPositions(stakeAccount),
    client.getTargetAccount(),
    client.getPoolDataAccount(),
    client.getRewardCustodyAccount(),
  ]);
}

/**
 * Retrieves staking information for a given wallet address.
 * Automatically discovers the staking account from the wallet address.
 * @param {string} walletAddress - The public key of the wallet to use.
 * @returns {Promise<{ info: PythStakingInfo; stakingAddress: string }>} - A promise that resolves to staking info and the discovered staking address.
 */
export async function getOISStakingInfo(
  walletAddress: string
): Promise<{ info: PythStakingInfo; stakingAddress: string }> {
  if (!walletAddress) {
    throw new Error("Wallet address is required");
  }

  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error("Invalid wallet address format");
  }

  let walletPublicKey: PublicKey;
  let client: PythStakingClient;

  try {
    walletPublicKey = new PublicKey(walletAddress);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid address format: ${errorMessage}`);
  }

  try {
    client = createPythStakingClientWithFallback(walletPublicKey, 0);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to create Pyth staking client: ${errorMessage}`);
  }

  try {
    const { client: responsiveClient, stakeAccount } =
      await discoverStakeAccount(client, walletPublicKey);

    // Fetch staking data, with endpoint fallback if the winning discovery client
    // gets rate-limited (429) on the data fetch calls.
    const allClients = RPC_ENDPOINTS.map((_, index) =>
      createPythStakingClientWithFallback(walletPublicKey, index)
    );
    // Put the responsive client first so we try it before the others.
    const orderedClients = [
      responsiveClient,
      ...allClients.filter((_, i) => RPC_ENDPOINTS[i] !== (responsiveClient as any).connection?.rpcEndpoint),
    ];

    let fetchResult: Awaited<ReturnType<typeof fetchStakingData>> | null = null;
    for (let i = 0; i < orderedClients.length; i++) {
      try {
        fetchResult = await fetchStakingData(orderedClients[i], stakeAccount);
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        if (!isSkippableRpcError(msg) || i === orderedClients.length - 1) throw err;
      }
    }
    const [rewards, positions, targetAccount, poolData, rewardCustodyAccount] = fetchResult!;

    const generalStats: PythGeneralStats = {
      totalGovernance:
        Number(targetAccount.locked + targetAccount.deltaLocked) * 1e-6,
      totalStaked:
        Number(
          sumDelegations(poolData.delState) +
            sumDelegations(poolData.selfDelState)
        ) * 1e-6,
      rewardsDistributed:
        Number(
          poolData.claimableRewards +
            INITIAL_REWARD_POOL_SIZE -
            rewardCustodyAccount.amount
        ) * 1e-6,
    };

    const publisherPoolData = extractPublisherData(poolData).map(
      ({ totalDelegation, totalDelegationDelta, pubkey, apyHistory }) => ({
        totalDelegation,
        totalDelegationDelta,
        pubkey: pubkey.toBase58(),
        apy: apyHistory[apyHistory.length - 1]?.apy ?? 0,
      })
    );

    // Calculate claimable rewards in PYTH
    const claimableRewards = Number(rewards?.totalRewards || 0n) * 1e-6;

    // Process positions more efficiently
    const StakeForEachPublisher: MyPublisherInfo[] = positions.data.positions
      .map((p) => {
        const publisher = p.targetWithParameters.integrityPool?.publisher;
        if (!publisher) return null;

        const key = String(publisher);
        const publisherData = publisherPoolData.find(
          (data) => data.pubkey === key
        );

        return {
          publisherKey: key,
          stakedAmount: Number(p.amount) * 1e-6,
          apy: publisherData?.apy ?? 0,
          rewards: 0, // Will be calculated after totalStakedPyth is known
        };
      })
      .filter((p): p is MyPublisherInfo => p !== null);

    // Calculate total staked amount more efficiently
    const totalStakedPyth = StakeForEachPublisher.reduce(
      (acc, publisher) => acc + publisher.stakedAmount,
      0
    );

    // Calculate rewards per validator proportionally based on staked amount
    StakeForEachPublisher.forEach((publisher) => {
      if (totalStakedPyth > 0 && claimableRewards > 0) {
        publisher.rewards =
          (publisher.stakedAmount / totalStakedPyth) * claimableRewards;
      } else {
        // Ensure rewards is always a number, default to 0
        publisher.rewards = 0;
      }
    });

    return {
      info: {
        StakeForEachPublisher,
        totalStakedPyth,
        claimableRewards,
        generalStats,
      },
      stakingAddress: stakeAccount.toBase58(),
    };
  } catch (error) {
    console.error("Error retrieving staking information:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Provide more specific error messages
    if (errorMessage.startsWith("No staking account found")) {
      throw new Error("No staking account found for this wallet");
    } else if (
      errorMessage.includes("discover staking account") &&
      errorMessage.includes("timed out")
    ) {
      throw new Error(
        "RPC timeout: Unable to discover staking account. Please try again later."
      );
    } else if (errorMessage.includes("Account does not exist")) {
      throw new Error("Staking account does not exist or has no positions");
    } else if (
      errorMessage.includes("Slot") &&
      errorMessage.includes("was skipped")
    ) {
      throw new Error(
        "RPC data unavailable: Historical slot data is missing. Please try again later."
      );
    } else if (isSkippableRpcError(errorMessage)) {
      throw new Error(
        "Unable to reach Solana network: all RPC endpoints failed. Please try again shortly."
      );
    } else if (
      errorMessage.includes("fetch") ||
      errorMessage.includes("network")
    ) {
      throw new Error("Network error: Unable to connect to Solana network");
    } else if (errorMessage.includes("Invalid public key")) {
      throw new Error("Invalid wallet or staking address format");
    } else {
      throw new Error(
        `Failed to retrieve staking information: ${errorMessage}`
      );
    }
  }
}

/**
 * Creates a Pyth Staking Client with the provided wallet public key.
 * Includes fallback RPC endpoints for better reliability.
 * @param {PublicKey} walletPublicKey - The public key of the wallet to use.
 * @returns {PythStakingClient} - An instance of PythStakingClient.
 */
function createPythStakingClient(
  walletPublicKey: PublicKey
): PythStakingClient {
  // Try to create connection with primary endpoint first
  let connection: Connection;

  try {
    connection = new Connection(RPC_ENDPOINTS[0], CONNECTION_CONFIG);
  } catch (error) {
    console.warn("Primary RPC endpoint failed, using fallback");
    connection = new Connection(RPC_ENDPOINTS[1], CONNECTION_CONFIG);
  }

  return new PythStakingClient({
    connection,
    wallet: {
      publicKey: walletPublicKey,
      signAllTransactions: () => Promise.reject("Not implemented"),
      signTransaction: () => Promise.reject("Not implemented"),
    },
  });
}

/**
 * Creates a Pyth Staking Client with fallback RPC endpoints
 * @param {PublicKey} walletPublicKey - The public key of the wallet to use.
 * @param {number} retryCount - Current retry attempt (0-based)
 * @returns {PythStakingClient} - An instance of PythStakingClient.
 */
function createPythStakingClientWithFallback(
  walletPublicKey: PublicKey,
  retryCount: number = 0
): PythStakingClient {
  const endpointIndex = Math.min(retryCount, RPC_ENDPOINTS.length - 1);
  const endpoint = RPC_ENDPOINTS[endpointIndex];

  const connection = new Connection(endpoint, CONNECTION_CONFIG);

  return new PythStakingClient({
    connection,
    wallet: {
      publicKey: walletPublicKey,
      signAllTransactions: () => Promise.reject("Not implemented"),
      signTransaction: () => Promise.reject("Not implemented"),
    },
  });
}

/**
 * Returns true if the error is a transient/auth HTTP error that warrants
 * skipping to the next RPC endpoint (429 rate-limit or 403 forbidden).
 */
function isSkippableRpcError(message: string): boolean {
  return (
    message.includes("429") ||
    message.includes("403") ||
    message.toLowerCase().includes("too many requests") ||
    message.toLowerCase().includes("rate limit") ||
    message.toLowerCase().includes("forbidden")
  );
}

/**
 * Discovers the stake account address for a wallet.
 * All RPC endpoints race in parallel (Promise.any) for the fastest response.
 * Endpoints that return 403/429 reject immediately, letting other endpoints win.
 */
async function discoverStakeAccount(
  client: PythStakingClient,
  walletPublicKey: PublicKey
): Promise<{ client: PythStakingClient; stakeAccount: PublicKey }> {
  const clients = RPC_ENDPOINTS.map((_, index) =>
    index === 0
      ? client
      : createPythStakingClientWithFallback(walletPublicKey, index)
  );

  const failures: string[] = [];

  try {
    const discovery = Promise.any(
      clients.map(async (rpcClient) => {
        const mainAccount = await rpcClient.getMainStakeAccount(walletPublicKey);
        if (!mainAccount) {
          throw new Error("No staking account found for this wallet");
        }
        return { client: rpcClient, stakeAccount: mainAccount.stakeAccountPosition };
      })
    );

    return await withTimeout(
      discovery,
      STAKE_ACCOUNT_DISCOVERY_TIMEOUT_MS,
      "Stake account discovery timed out across all RPC endpoints"
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("timed out across all RPC endpoints")) {
      throw new Error("Failed to discover staking account: all RPC endpoints timed out");
    }

    // AggregateError from Promise.any — collect all rejection reasons
    if (error instanceof AggregateError) {
      const msgs = error.errors.map((e: unknown) =>
        e instanceof Error ? e.message : "Unknown error"
      );
      failures.push(...msgs);
    } else {
      failures.push(errorMessage);
    }

    if (failures.some((msg) => msg.startsWith("No staking account"))) {
      throw new Error("No staking account found for this wallet");
    }

    const lastError = failures[failures.length - 1] ?? "Unknown error";
    throw new Error(`Failed to discover staking account: ${lastError}`);
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

/**
 * Retrieves the claimable rewards for a given stake account.
 * @param {PythStakingClient} client - The Pyth Staking Client instance.
 * @param {PublicKey} stakeAccount - The public key of the stake account.
 * @returns {Promise<{ totalRewards: bigint }>} - A promise that resolves to the claimable rewards.
 */
async function getClaimableRewards(
  client: PythStakingClient,
  stakeAccount: PublicKey,
  retryCount: number = 0
) {
  try {
    const result = await client.getClaimableRewards(stakeAccount);
    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Handle specific RPC errors related to missing slot data
    if (errorMessage.includes("Slot") && errorMessage.includes("was skipped")) {
      return { totalRewards: 0n };
    }

    // If it's a rate-limit or network error and we haven't tried all endpoints, retry with different RPC
    if (
      retryCount < RPC_ENDPOINTS.length - 1 &&
      (isSkippableRpcError(errorMessage) || errorMessage.includes("fetch") || errorMessage.includes("network"))
    ) {
      const newClient = createPythStakingClientWithFallback(
        client.wallet.publicKey,
        retryCount + 1
      );
      return await getClaimableRewards(newClient, stakeAccount, retryCount + 1);
    }

    throw new Error(`Failed to fetch claimable rewards: ${errorMessage}`);
  }
}

const sumDelegations = (
  values: { totalDelegation: bigint; deltaDelegation: bigint }[]
) =>
  values.reduce(
    (acc, value) => acc + value.totalDelegation + value.deltaDelegation,
    0n
  );

/**
 * Retrieves general statistics about the Pyth staking pool.
 * @param client - The Pyth Staking Client instance.
 * @description Retrieves general statistics about the Pyth staking pool, including total governance, total staked, and rewards distributed.
 * @returns {Promise<{ totalGovernance: number; totalStaked: number; rewardsDistributed: number }>} - A promise that resolves to an object containing the statistics.
 */
async function getPythGeneralStats(
  client: PythStakingClient
): Promise<PythGeneralStats> {
  try {
    const [targetAccount, poolData, rewardCustodyAccount] = await Promise.all([
      client.getTargetAccount(),
      client.getPoolDataAccount(),
      client.getRewardCustodyAccount(),
    ]);

    return {
      totalGovernance:
        Number(targetAccount.locked + targetAccount.deltaLocked) * 1e-6,
      totalStaked:
        Number(
          sumDelegations(poolData.delState) +
            sumDelegations(poolData.selfDelState)
        ) * 1e-6,
      rewardsDistributed:
        Number(
          poolData.claimableRewards +
            INITIAL_REWARD_POOL_SIZE -
            rewardCustodyAccount.amount
        ) * 1e-6,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch general stats: ${errorMessage}`);
  }
}

/**
 * Retrieves the publisher pool data from the Pyth Staking Client.
 * @param {PythStakingClient} client - The Pyth Staking Client instance.
 * @returns {Promise<Array<{ totalDelegation: bigint; totalDelegationDelta: bigint; pubkey: string; apy: number }>>} - A promise that resolves to an array of publisher data.
 */
async function getPublisherPoolData(client: PythStakingClient) {
  try {
    const poolData = await client.getPoolDataAccount();
    const publisherData = extractPublisherData(poolData);

    return publisherData.map(
      ({ totalDelegation, totalDelegationDelta, pubkey, apyHistory }) => ({
        totalDelegation,
        totalDelegationDelta,
        pubkey: pubkey.toBase58(),
        apy: apyHistory[apyHistory.length - 1]?.apy ?? 0,
      })
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch publisher pool data: ${errorMessage}`);
  }
}

/**
 * Refreshes staking information for a wallet using a known staking address.
 * Skips account discovery — use this on reload when stakingAddress is already stored.
 * @param {string} walletAddress - The public key of the wallet.
 * @param {string} stakingAddress - The known staking account address.
 * @returns {Promise<{ info: PythStakingInfo; stakingAddress: string }>}
 */
export async function refreshOISStakingInfo(
  walletAddress: string,
  stakingAddress: string
): Promise<{ info: PythStakingInfo; stakingAddress: string }> {
  if (!walletAddress) throw new Error("Wallet address is required");
  if (!stakingAddress) throw new Error("Staking address is required");
  if (!isValidSolanaAddress(walletAddress))
    throw new Error("Invalid wallet address format");
  if (!isValidSolanaAddress(stakingAddress))
    throw new Error("Invalid staking address format");

  const walletPublicKey = new PublicKey(walletAddress);
  const stakeAccount = new PublicKey(stakingAddress);
  let lastError = "Unknown error";

  for (let index = 0; index < RPC_ENDPOINTS.length; index++) {
    const client = createPythStakingClientWithFallback(walletPublicKey, index);

    try {
      return await fetchStakingInfoForAccount(client, stakeAccount, stakingAddress);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  throw new Error(`Failed to refresh staking information: ${lastError}`);
}

async function fetchStakingInfoForAccount(
  client: PythStakingClient,
  stakeAccount: PublicKey,
  stakingAddress: string
): Promise<{ info: PythStakingInfo; stakingAddress: string }> {
  const [rewards, positions, targetAccount, poolData, rewardCustodyAccount] =
    await Promise.all([
      getClaimableRewards(client, stakeAccount).catch(() => ({
        totalRewards: 0n,
      })),
      client.getStakeAccountPositions(stakeAccount),
      client.getTargetAccount(),
      client.getPoolDataAccount(),
      client.getRewardCustodyAccount(),
    ]);

  const generalStats: PythGeneralStats = {
    totalGovernance:
      Number(targetAccount.locked + targetAccount.deltaLocked) * 1e-6,
    totalStaked:
      Number(
        sumDelegations(poolData.delState) +
          sumDelegations(poolData.selfDelState)
      ) * 1e-6,
    rewardsDistributed:
      Number(
        poolData.claimableRewards +
          INITIAL_REWARD_POOL_SIZE -
          rewardCustodyAccount.amount
      ) * 1e-6,
  };

  const publisherPoolData = extractPublisherData(poolData).map(
    ({ totalDelegation, totalDelegationDelta, pubkey, apyHistory }) => ({
      totalDelegation,
      totalDelegationDelta,
      pubkey: pubkey.toBase58(),
      apy: apyHistory[apyHistory.length - 1]?.apy ?? 0,
    })
  );

  const claimableRewards = Number(rewards?.totalRewards || 0n) * 1e-6;

  const StakeForEachPublisher: MyPublisherInfo[] = positions.data.positions
    .map((p) => {
      const publisher = p.targetWithParameters.integrityPool?.publisher;
      if (!publisher) return null;
      const key = String(publisher);
      const publisherData = publisherPoolData.find((d) => d.pubkey === key);
      return {
        publisherKey: key,
        stakedAmount: Number(p.amount) * 1e-6,
        apy: publisherData?.apy ?? 0,
        rewards: 0,
      };
    })
    .filter((p): p is MyPublisherInfo => p !== null);

  const totalStakedPyth = StakeForEachPublisher.reduce(
    (acc, p) => acc + p.stakedAmount,
    0
  );

  StakeForEachPublisher.forEach((p) => {
    p.rewards =
      totalStakedPyth > 0 && claimableRewards > 0
        ? (p.stakedAmount / totalStakedPyth) * claimableRewards
        : 0;
  });

  return {
    info: { StakeForEachPublisher, totalStakedPyth, claimableRewards, generalStats },
    stakingAddress,
  };
}

/**
 * Fetches the latest Pyth price for a specific asset.
 * @returns {Promise<number>} - A promise that resolves to the latest Pyth price in base units.
 * @throws {Error} - Throws an error if the fetch operation fails or if the response is not ok.
 */
export async function getPythPrice() {
  const PYTH_PRICE_ID =
    "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff";
  const PYTH_API_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${PYTH_PRICE_ID}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(PYTH_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "PythBoard/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.parsed || !data.parsed[0] || !data.parsed[0].price) {
      throw new Error("Invalid price data format received");
    }

    return Number(data.parsed[0].price.price) * 1e-8; // Convert from micro to base units
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(
          "Request timeout: Failed to fetch Pyth price within 10 seconds"
        );
      }
      throw new Error(`Failed to fetch Pyth price: ${error.message}`);
    }

    throw new Error("Failed to fetch Pyth price: Unknown error");
  }
}
