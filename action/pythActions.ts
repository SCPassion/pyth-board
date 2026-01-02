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

// RPC endpoints with fallback support
const RPC_ENDPOINTS = [
  "https://solana-mainnet.g.alchemy.com/v2/VAWGO1qOMcxkm0B9H0xUPzpNMzBnIvo8",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-api.projectserum.com",
];

// Connection configuration for better performance
const CONNECTION_CONFIG = {
  commitment: "confirmed" as const,
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
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
 * Retrieves staking information for a given wallet address and staking address.
 * @param {string} walletAddress - The public key of the wallet to use.
 * @param {string} stakingAddress - The public key of the staking account.
 * @returns {Promise<PythStakingInfo>} - A promise that resolves to an object containing staking information.
 */
export async function getOISStakingInfo(
  walletAddress: string,
  stakingAddress: string
): Promise<PythStakingInfo> {
  // Input validation
  if (!walletAddress || !stakingAddress) {
    throw new Error("Wallet address and staking address are required");
  }

  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error("Invalid wallet address format");
  }

  if (!isValidSolanaAddress(stakingAddress)) {
    throw new Error("Invalid staking address format");
  }

  let stakeAccount: PublicKey;
  let walletPublicKey: PublicKey;
  let client: PythStakingClient;

  try {
    stakeAccount = new PublicKey(stakingAddress);
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
    try {
      const accountInfo = await client.connection.getAccountInfo(stakeAccount);
      if (!accountInfo) {
        throw new Error("Staking account does not exist");
      }
    } catch (accountError) {
      throw new Error("Staking account does not exist or is invalid");
    }

    // Try to fetch rewards with fallback mechanism
    let rewards;
    let rewardsSuccess = false;

    // Try with current client first
    try {
      rewards = await getClaimableRewards(client, stakeAccount);
      rewardsSuccess = true;
    } catch (rewardError) {
      // Try with different RPC endpoints
      for (let i = 1; i < RPC_ENDPOINTS.length && !rewardsSuccess; i++) {
        try {
          const fallbackClient = createPythStakingClientWithFallback(
            walletPublicKey,
            i
          );
          rewards = await getClaimableRewards(fallbackClient, stakeAccount);
          rewardsSuccess = true;
        } catch (fallbackError) {
          // Continue to next endpoint
        }
      }

      if (!rewardsSuccess) {
        rewards = { totalRewards: 0n };
      }
    }

    // Fetch other data in parallel
    const [generalStats, positions, publisherPoolData] = await Promise.all([
      getPythGeneralStats(client),
      client.getStakeAccountPositions(stakeAccount),
      getPublisherPoolData(client),
    ]);

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
      StakeForEachPublisher,
      totalStakedPyth,
      claimableRewards,
      generalStats,
    };
  } catch (error) {
    console.error("Error retrieving staking information:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Provide more specific error messages
    if (errorMessage.includes("Account does not exist")) {
      throw new Error("Staking account does not exist or has no positions");
    } else if (
      errorMessage.includes("Slot") &&
      errorMessage.includes("was skipped")
    ) {
      throw new Error(
        "RPC data unavailable: Historical slot data is missing. Please try again later."
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

    // If it's a network error and we haven't tried all endpoints, retry with different RPC
    if (
      retryCount < RPC_ENDPOINTS.length - 1 &&
      (errorMessage.includes("fetch") || errorMessage.includes("network"))
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
