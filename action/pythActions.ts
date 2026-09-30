"use server";

import type { PythStakingInfo, GovernanceStakeAccount } from "@/types/pythTypes";
import { PythStakingClient, PositionState, summarizeAccountPositions } from "@pythnetwork/staking-sdk";
import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";

const RPC_TIMEOUT_MS = 10000;
const rpcEndpoints = () => [...new Set([
  ...(process.env.PRIMARY_SOLANA_RPC_URL ? [process.env.PRIMARY_SOLANA_RPC_URL] : []),
  "https://api.mainnet-beta.solana.com",
])];

function createClient(endpoint: string) {
  const signal = AbortSignal.timeout(RPC_TIMEOUT_MS);
  return new PythStakingClient({
    connection: new Connection(endpoint, {
      commitment: "confirmed",
      disableRetryOnRateLimit: true,
      fetch: (input, init) => fetch(input, { ...init, signal }),
    }),
  });
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Governance RPC timed out")), RPC_TIMEOUT_MS);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

function validateWallet(address: string): PublicKey {
  if (!address) throw new Error("Wallet address is required");
  try { return new PublicKey(address); }
  catch { throw new Error("Invalid wallet address format"); }
}

async function readWallet(client: PythStakingClient, owner: PublicKey) {
  const [addresses, clock] = await Promise.all([
    client.getAllStakeAccountPositions(owner),
    client.connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY),
  ]);
  if (!clock || clock.data.length < 40) throw new Error("Governance clock unavailable");
  const timestamp = clock.data.readBigInt64LE(32);
  if (timestamp < 0n) throw new Error("Invalid governance clock");
  const epoch = timestamp / 604800n;
  const accounts: GovernanceStakeAccount[] = [];
  // Bound parallel account reads; count every account, rather than only the main one.
  const uniqueAddresses = [...new Map(addresses.map(address => [address.toBase58(), address])).values()];
  for (let offset = 0; offset < uniqueAddresses.length; offset += 10) {
    const rows = await Promise.all(uniqueAddresses.slice(offset, offset + 10).map(async address => {
      const positions = await client.getStakeAccountPositions(address);
      if (!positions.data.owner.equals(owner)) throw new Error("Stake account owner mismatch");
      const voting = summarizeAccountPositions(positions, epoch).voting;
      const active = voting[PositionState.LOCKED];
      const warmingUp = voting[PositionState.LOCKING];
      const unstaking = voting[PositionState.PREUNLOCKING] + voting[PositionState.UNLOCKING];
      return {
        address: address.toBase58(),
        totalStakedPyth: Number(active + warmingUp + unstaking) / 1e6,
        activePyth: Number(active) / 1e6,
        warmingUpPyth: Number(warmingUp) / 1e6,
        unstakingPyth: Number(unstaking) / 1e6,
      };
    }));
    accounts.push(...rows);
  }
  accounts.sort((a, b) => b.totalStakedPyth - a.totalStakedPyth || a.address.localeCompare(b.address));
  const info: PythStakingInfo = {
    kind: "governance",
    totalStakedPyth: accounts.reduce((sum, account) => sum + account.totalStakedPyth, 0),
    activePyth: accounts.reduce((sum, account) => sum + account.activePyth, 0),
    warmingUpPyth: accounts.reduce((sum, account) => sum + account.warmingUpPyth, 0),
    unstakingPyth: accounts.reduce((sum, account) => sum + account.unstakingPyth, 0),
    stakingAccounts: accounts,
  };
  return { info, stakingAddress: accounts[0]?.address ?? "" };
}

/** Reads governance positions across every staking account owned by the wallet. */
export async function getGovernanceStakingInfo(walletAddress: string): Promise<{
  info: PythStakingInfo; stakingAddress: string;
}> {
  const owner = validateWallet(walletAddress);
  for (const endpoint of rpcEndpoints()) {
    try { return await withTimeout(readWallet(createClient(endpoint), owner)); }
    catch { /* Retry the complete read, so failed accounts never produce a partial total. */ }
  }
  throw new Error("Unable to load governance balances from Solana. Please try again later.");
}

/** Rediscover accounts on refresh to include newly created governance positions. */
export async function refreshGovernanceStakingInfo(walletAddress: string) {
  return getGovernanceStakingInfo(walletAddress);
}

/** Reads the global governance target account without discovering a wallet. */
export async function getGovernanceTotalStaked(): Promise<number | null> {
  for (const endpoint of rpcEndpoints()) {
    try {
      const target = await withTimeout(createClient(endpoint).getTargetAccount());
      const total = Number(target.locked + target.deltaLocked) / 1e6;
      if (!Number.isFinite(total) || total < 0) throw new Error("Invalid governance total");
      return total;
    } catch { /* Never report a failed read as zero. */ }
  }
  return null;
}

/** Fetches the latest PYTH price from Hermes. */
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
