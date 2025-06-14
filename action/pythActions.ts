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
  const stakeAccount = new PublicKey(stakingAddress);
  const walletPublicKey = new PublicKey(walletAddress);

  const client = createPythStakingClient(walletPublicKey);

  try {
    const generalStats = await getPythGeneralStats(client);
    const rewards = await getClaimableRewards(client, stakeAccount);
    const positions = await client.getStakeAccountPositions(stakeAccount);
    const publisherPoolData = await getPublisherPoolData(client);

    // Calculate claimable rewards in PYTH
    const claimableRewards = Number(rewards.totalRewards) * 1e-6;

    // Prepare the StakeForEachPublisher array
    const StakeForEachPublisher: MyPublisherInfo[] = [];
    positions.data.positions.forEach((p, index) => {
      const publisher = p.targetWithParameters.integrityPool?.publisher;
      if (publisher) {
        const key = String(publisher);
        StakeForEachPublisher.push({
          publisherKey: key,
          stakedAmount: Number(p.amount) * 1e-6,
          apy: publisherPoolData.find((data) => data.pubkey === key)?.apy ?? 0, // Placeholder, will be updated below
        });
      }
    });

    // update total staked amount for your wallet
    let totalStakedPyth = StakeForEachPublisher.reduce(
      (acc, publisher) => acc + publisher.stakedAmount,
      0
    );

    return {
      StakeForEachPublisher,
      totalStakedPyth,
      claimableRewards,
      generalStats,
    };
  } catch (error) {
    console.error("Error retrieving staking information:", error);
    throw new Error("Failed to retrieve staking information");
  }
}

/**
 * Creates a Pyth Staking Client with the provided wallet public key.
 * @param {PublicKey} walletPublicKey - The public key of the wallet to use.
 * @returns {PythStakingClient} - An instance of PythStakingClient.
 */
function createPythStakingClient(
  walletPublicKey: PublicKey
): PythStakingClient {
  return new PythStakingClient({
    connection: new Connection(
      "https://solana-mainnet.g.alchemy.com/v2/n4ktNDxGrhvqeuojBt-7W"
    ),
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
  return client.getClaimableRewards(stakeAccount);
}

const sumDelegations = (
  values: { totalDelegation: bigint; deltaDelegation: bigint }[]
) =>
  values.reduce(
    (acc, value) => acc + value.totalDelegation + value.deltaDelegation,
    0n
  );

/**
 *
 * @param client - The Pyth Staking Client instance.
 * @description Retrieves general statistics about the Pyth staking pool, including total governance, total staked, and rewards distributed.
 * @returns {Promise<{ totalGovernance: number; totalStaked: number; rewardsDistributed: number }>} - A promise that resolves to an object containing the statistics.
 */
async function getPythGeneralStats(
  client: PythStakingClient
): Promise<PythGeneralStats> {
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
}

/**
 * Retrieves the publisher pool data from the Pyth Staking Client.
 * @param {PythStakingClient} client - The Pyth Staking Client instance.
 * @returns {Promise<Array<{ totalDelegation: bigint; totalDelegationDelta: bigint; pubkey: string; apy: number }>>} - A promise that resolves to an array of publisher data.
 */
async function getPublisherPoolData(client: PythStakingClient) {
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
}

/**
 * Fetches the latest Pyth price for a specific asset.
 * @returns {Promise<number>} - A promise that resolves to the latest Pyth price in base units.
 * @throws {Error} - Throws an error if the fetch operation fails or if the response is not ok.
 */
export async function getPythPrice() {
  try {
    const response = await fetch(
      "https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff"
    );
    if (!response.ok) {
      throw new Error("Failed to fetch Pyth price data");
    }
    const data = await response.json();
    return Number(data.parsed[0].price.price) * 1e-8; // Convert from micro to base units
  } catch (error) {
    if (error instanceof Error) {
      alert("Error fetching Pyth price: " + error.message);
      throw new Error("Failed to fetch Pyth price");
    }
  }
}
