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
import { getSolanaRpcEndpoints } from "@/lib/solana-rpc";

const INITIAL_REWARD_POOL_SIZE = 60_000_000_000_000n;

// RPC endpoints with fallback support
const RPC_ENDPOINTS = getSolanaRpcEndpoints();

// Connection configuration for better performance
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

type OISStakingInfoResult = {
  stakingAddress: string;
  stakingInfo: PythStakingInfo;
};

const CACHE_TTL_MS = 60_000;
const STALE_CACHE_TTL_MS = 10 * 60_000;
const walletStakingInfoCache = new Map<
  string,
  { value: OISStakingInfoResult; updatedAt: number }
>();
const inflightWalletRequests = new Map<string, Promise<OISStakingInfoResult>>();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function isRateLimitError(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("compute units per second")
  );
}

function isTransientRpcError(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return (
    isRateLimitError(msg) ||
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("temporarily unavailable")
  );
}

function isNonRetryableStakingError(errorMessage: string): boolean {
  return (
    errorMessage.includes("No staking account found for this wallet") ||
    errorMessage.includes("Staking account does not exist or is invalid") ||
    errorMessage.includes("Invalid wallet address format") ||
    errorMessage.includes("Invalid address format")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOISStakingInfoWithClient(
  client: PythStakingClient,
  walletPublicKey: PublicKey,
  endpointIndex: number
): Promise<OISStakingInfoResult> {
  // Avoid getMainStakeAccount(): it performs extra per-account RPC calls.
  const stakeAccounts = await client.getAllStakeAccountPositions(walletPublicKey);
  const stakeAccount = stakeAccounts[0];
  if (!stakeAccount) {
    throw new Error("No staking account found for this wallet. Stake with Pyth first.");
  }

  // Rewards are best-effort to keep wallet-add responsive under RPC pressure.
  let rewards = { totalRewards: 0n };
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const currentIndex = (endpointIndex + i) % RPC_ENDPOINTS.length;
    const rewardsClient =
      i === 0
        ? client
        : createPythStakingClientWithFallback(walletPublicKey, currentIndex);
    try {
      rewards = await getClaimableRewards(rewardsClient, stakeAccount);
      break;
    } catch (error) {
      const message = getErrorMessage(error);
      if (!isTransientRpcError(message) || i === RPC_ENDPOINTS.length - 1) {
        rewards = { totalRewards: 0n };
        break;
      }
      await sleep(100);
    }
  }

  // Fetch required data in parallel and avoid duplicate pool-account RPCs.
  const [targetAccount, poolData, rewardCustodyAccount, positions] =
    await Promise.all([
      client.getTargetAccount(),
      client.getPoolDataAccount(),
      client.getRewardCustodyAccount(),
      client.getStakeAccountPositions(stakeAccount),
    ]);

  const generalStats: PythGeneralStats = {
    totalGovernance:
      Number(targetAccount.locked + targetAccount.deltaLocked) * 1e-6,
    totalStaked:
      Number(
        sumDelegations(poolData.delState) + sumDelegations(poolData.selfDelState)
      ) * 1e-6,
    rewardsDistributed:
      Number(
        poolData.claimableRewards +
          INITIAL_REWARD_POOL_SIZE -
          rewardCustodyAccount.amount
      ) * 1e-6,
  };

  const publisherPoolData = extractPublisherData(poolData).map(
    ({ pubkey, apyHistory }) => ({
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
      const publisherData = publisherPoolData.find((data) => data.pubkey === key);

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
    stakingAddress: stakeAccount.toBase58(),
    stakingInfo: {
      StakeForEachPublisher,
      totalStakedPyth,
      claimableRewards,
      generalStats,
    },
  };
}

/**
 * Retrieves staking information for a given wallet address.
 * The staking account is derived from the wallet owner.
 * @param {string} walletAddress - The public key of the wallet to use.
 * @returns {Promise<OISStakingInfoResult>} - A promise that resolves to staking account + staking information.
 */
export async function getOISStakingInfo(
  walletAddress: string
): Promise<OISStakingInfoResult> {
  // Input validation
  if (!walletAddress) {
    throw new Error("Wallet address is required");
  }

  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error("Invalid wallet address format");
  }

  let walletPublicKey: PublicKey;

  try {
    walletPublicKey = new PublicKey(walletAddress);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    throw new Error(`Invalid address format: ${errorMessage}`);
  }

  const cacheEntry = walletStakingInfoCache.get(walletAddress);
  const now = Date.now();
  if (cacheEntry && now - cacheEntry.updatedAt < CACHE_TTL_MS) {
    return cacheEntry.value;
  }

  const existingInFlight = inflightWalletRequests.get(walletAddress);
  if (existingInFlight) {
    return existingInFlight;
  }

  const request = (async () => {
    const endpointErrors: string[] = [];

    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
      try {
        const client = createPythStakingClientWithFallback(walletPublicKey, i);
        const result = await fetchOISStakingInfoWithClient(
          client,
          walletPublicKey,
          i
        );
        walletStakingInfoCache.set(walletAddress, {
          value: result,
          updatedAt: Date.now(),
        });
        return result;
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        endpointErrors.push(`RPC #${i + 1}: ${errorMessage}`);

        if (isNonRetryableStakingError(errorMessage)) {
          throw error;
        }

        if (isTransientRpcError(errorMessage)) {
          await sleep(200 * (i + 1));
        }
      }
    }

    const staleEntry = walletStakingInfoCache.get(walletAddress);
    if (staleEntry && Date.now() - staleEntry.updatedAt < STALE_CACHE_TTL_MS) {
      return staleEntry.value;
    }

    throw new Error(endpointErrors.join(" | "));
  })();

  inflightWalletRequests.set(walletAddress, request);

  try {
    return await request;
  } catch (error) {
    console.error("Error retrieving staking information:", error);
    const errorMessage = getErrorMessage(error);

    if (errorMessage.includes("Account does not exist")) {
      throw new Error("Staking account does not exist or has no positions");
    }
    if (errorMessage.includes("Slot") && errorMessage.includes("was skipped")) {
      throw new Error(
        "RPC data unavailable: Historical slot data is missing. Please try again later."
      );
    }
    if (isRateLimitError(errorMessage)) {
      throw new Error(
        "RPC rate limit reached across providers. Please try again in a few seconds."
      );
    }
    if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
      throw new Error(
        "RPC providers are currently unavailable. Please try again in a few seconds."
      );
    }
    if (errorMessage.includes("Invalid public key")) {
      throw new Error("Invalid wallet address format");
    }
    throw new Error(`Failed to retrieve staking information: ${errorMessage}`);
  } finally {
    inflightWalletRequests.delete(walletAddress);
  }
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
 * Retrieves the claimable rewards for a given stake account.
 * @param {PythStakingClient} client - The Pyth Staking Client instance.
 * @param {PublicKey} stakeAccount - The public key of the stake account.
 * @returns {Promise<{ totalRewards: bigint }>} - A promise that resolves to the claimable rewards.
 */
async function getClaimableRewards(
  client: PythStakingClient,
  stakeAccount: PublicKey
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
