"use server";

import type {
  ReserveAccountInfo,
  TokenBalance,
  PythReserveSummary,
} from "@/types/pythTypes";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  DAO_TREASURY_ADDRESS,
  PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS,
  TOKEN_SYMBOLS,
} from "@/data/pythReserveAddresses";

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
 * Creates a Solana connection with fallback RPC endpoints
 */
function createConnection(retryCount: number = 0): Connection {
  const endpointIndex = Math.min(retryCount, RPC_ENDPOINTS.length - 1);
  const endpoint = RPC_ENDPOINTS[endpointIndex];
  return new Connection(endpoint, CONNECTION_CONFIG);
}

/**
 * Validates Solana public key format
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
 * Gets the SOL balance for an account
 */
async function getSolBalance(
  connection: Connection,
  address: string
): Promise<number> {
  try {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9; // Convert lamports to SOL
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch SOL balance: ${errorMessage}`);
  }
}

/**
 * Gets token account balances for an address
 * Note: This is a simplified version. For production, you may want to use
 * @solana/spl-token library to get all token accounts more efficiently
 */
async function getTokenBalances(
  connection: Connection,
  address: string
): Promise<TokenBalance[]> {
  try {
    const publicKey = new PublicKey(address);
    
    // Get all token accounts owned by this address
    // Using the SPL Token program ID
    const TOKEN_PROGRAM_ID = new PublicKey(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    );
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    const balances: TokenBalance[] = [];

    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed?.info;
      if (!parsedInfo) continue;

      const mint = parsedInfo.mint;
      const amount = parsedInfo.tokenAmount?.uiAmount || 0;
      const decimals = parsedInfo.tokenAmount?.decimals || 0;

      // Skip tokens with zero balance
      if (amount === 0 || amount === null || amount === undefined) {
        continue;
      }

      // Determine token symbol based on mint address
      // Only use symbols from TOKEN_SYMBOLS - never guess or infer
      const symbol = TOKEN_SYMBOLS[mint] || mint.slice(0, 4) + "..." + mint.slice(-4);

      balances.push({
        mint,
        symbol,
        amount,
        decimals,
      });
    }

    // Deduplicate tokens with the same mint address by combining their amounts
    const tokenMap = new Map<string, TokenBalance>();
    for (const token of balances) {
      const existing = tokenMap.get(token.mint);
      if (existing) {
        // Combine amounts for the same mint
        existing.amount += token.amount;
      } else {
        tokenMap.set(token.mint, { ...token });
      }
    }

    return Array.from(tokenMap.values());
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to fetch token balances: ${errorMessage}`);
    // Return empty array on error rather than throwing
    return [];
  }
}

/**
 * Generic function to fetch price from Pyth Network Hermes API
 * @param priceId - The price feed ID (hex string without 0x prefix)
 * @returns Promise<number> - The price in USD, or 0 if fetch fails
 */
async function getPriceFromHermes(priceId: string): Promise<number> {
  const HERMES_API_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${priceId}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(HERMES_API_URL, {
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

    return Number(data.parsed[0].price.price) * 1e-8;
  } catch (error) {
    clearTimeout(timeoutId);
    // Return 0 if price fetch fails
    return 0;
  }
}

/**
 * Fetches PYTH price for USD value calculations
 */
async function getPythPrice(): Promise<number> {
  const PYTH_PRICE_ID =
    "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff";
  return await getPriceFromHermes(PYTH_PRICE_ID);
}

export async function getCurrentPythPriceUsd(): Promise<number> {
  return await getPythPrice();
}

/**
 * Fetches SOL price for USD value calculations
 */
async function getSolPrice(): Promise<number> {
  // SOL/USD price feed ID from Pyth Network
  // Correct ID: 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
  const SOL_PRICE_ID =
    "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
  return await getPriceFromHermes(SOL_PRICE_ID);
}

/**
 * Fetches USDC price for USD value calculations
 */
async function getUsdcPrice(): Promise<number> {
  // USDC/USD price feed ID from Pyth Network
  const USDC_PRICE_ID =
    "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";
  return await getPriceFromHermes(USDC_PRICE_ID);
}

/**
 * Fetches USDT price for USD value calculations
 */
async function getUsdtPrice(): Promise<number> {
  // USDT/USD price feed ID from Pyth Network
  const USDT_PRICE_ID =
    "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b";
  return await getPriceFromHermes(USDT_PRICE_ID);
}

/**
 * Gets account information for a reserve address
 */
async function getReserveAccountInfo(
  address: string,
  name: string
): Promise<ReserveAccountInfo> {
  if (!isValidSolanaAddress(address)) {
    throw new Error(`Invalid address format: ${address}`);
  }

  let connection = createConnection(0);
  let solBalance = 0;
  let tokenBalances: TokenBalance[] = [];

  // Try with fallback endpoints
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    try {
      connection = createConnection(i);
      [solBalance, tokenBalances] = await Promise.all([
        getSolBalance(connection, address),
        getTokenBalances(connection, address),
      ]);
      break; // Success, exit loop
    } catch (error) {
      if (i === RPC_ENDPOINTS.length - 1) {
        // Last attempt failed
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        throw new Error(
          `Failed to fetch account info after all retries: ${errorMessage}`
        );
      }
      // Continue to next endpoint
    }
  }

  // Get prices from Hermes API for USD calculations
  const [pythPrice, solPrice, usdcPrice, usdtPrice] = await Promise.all([
    getPythPrice(),
    getSolPrice(),
    getUsdcPrice(),
    getUsdtPrice(),
  ]);

  // Calculate USD values
  // Use fallback prices if fetch failed (0 means fetch failed)
  const effectiveSolPrice = solPrice > 0 ? solPrice : 150; // Fallback to approximate if fetch fails
  const effectiveUsdcPrice = usdcPrice > 0 ? usdcPrice : 1; // Fallback to 1:1 if fetch fails
  const effectiveUsdtPrice = usdtPrice > 0 ? usdtPrice : 1; // Fallback to 1:1 if fetch fails
  
  // Separate wrapped SOL tokens from other tokens
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const wrappedSolTokens = tokenBalances.filter(
    (token) => token.mint === SOL_MINT
  );
  const otherTokens = tokenBalances.filter(
    (token) => token.mint !== SOL_MINT
  );
  
  // Calculate total wrapped SOL amount
  const totalWrappedSol = wrappedSolTokens.reduce(
    (sum, token) => sum + token.amount,
    0
  );
  
  // Combine native SOL and wrapped SOL for total SOL value
  const totalSolAmount = solBalance + totalWrappedSol;
  const totalSolValue = totalSolAmount * effectiveSolPrice;

  // Find PYTH mint address from TOKEN_SYMBOLS
  const PYTH_MINT = Object.keys(TOKEN_SYMBOLS).find(
    (mint) => TOKEN_SYMBOLS[mint] === "PYTH"
  );

  // Calculate USD values for non-SOL tokens only (wrapped SOL is included in native SOL)
  const updatedTokenBalances = otherTokens.map((token) => {
    let usdValue = 0;
    if (token.symbol === "USDC") {
      // Use USDC price from Hermes API
      usdValue = token.amount * effectiveUsdcPrice;
    } else if (token.symbol === "PYTH" && pythPrice > 0) {
      // Only calculate USD value if it's actually PYTH (symbol from TOKEN_SYMBOLS)
      usdValue = token.amount * pythPrice;
    } else if (token.symbol === "USDT") {
      // Use USDT price from Hermes API
      usdValue = token.amount * effectiveUsdtPrice;
    }

    return {
      ...token,
      usdValue,
    };
  });

  // Total = combined SOL (native + wrapped) + all other tokens
  const totalTokenValue = updatedTokenBalances.reduce(
    (sum, token) => sum + (token.usdValue || 0),
    0
  );
  const totalUsdValue = totalSolValue + totalTokenValue;

  return {
    address,
    name,
    solBalance: totalSolAmount, // Combined native + wrapped SOL
    tokenBalances: updatedTokenBalances, // Only non-SOL tokens
    totalUsdValue,
    solPrice: effectiveSolPrice,
  };
}

/**
 * Gets the complete Pyth Reserve Summary
 * This is the main function to fetch all reserve data
 */
export async function getPythReserveSummary(): Promise<PythReserveSummary> {
  try {
    // Fetch both accounts in parallel
    const [daoTreasury, pythianCouncilOps] = await Promise.all([
      getReserveAccountInfo(
        DAO_TREASURY_ADDRESS,
        "DAO Treasury"
      ),
      getReserveAccountInfo(
        PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS,
        "Pythian Council Ops Multisig"
      ),
    ]);

    // Filter DAO Treasury to only show tokens defined in TOKEN_SYMBOLS
    // This includes USDC, USDT, SOL, and PYTH
    // Also filter out tokens with zero balance
    // Note: getReserveAccountInfo already combines native SOL and wrapped SOL,
    // and excludes wrapped SOL from tokenBalances, so we just need to filter to TOKEN_SYMBOLS
    const filteredDaoTreasuryBalances = daoTreasury.tokenBalances
      .filter((token) => {
        // Check if the token's mint address exists in TOKEN_SYMBOLS
        // and ensure the symbol matches what's in TOKEN_SYMBOLS (not just any "PYTH" string)
        const expectedSymbol = TOKEN_SYMBOLS[token.mint];
        return expectedSymbol !== undefined && token.symbol === expectedSymbol;
      })
      .filter((token) => token.amount > 0); // Only show tokens with balance > 0

    // Recalculate total USD value for DAO Treasury after filtering
    const [pythPrice, solPrice, usdcPrice, usdtPrice] = await Promise.all([
      getPythPrice(),
      getSolPrice(),
      getUsdcPrice(),
      getUsdtPrice(),
    ]);
    // Use fallback prices if fetch failed
    const effectiveSolPrice = solPrice > 0 ? solPrice : 150;
    const effectiveUsdcPrice = usdcPrice > 0 ? usdcPrice : 1;
    const effectiveUsdtPrice = usdtPrice > 0 ? usdtPrice : 1;
    
    // Recalculate USD values for filtered tokens using prices from Hermes API
    const recalculatedTokenBalances = filteredDaoTreasuryBalances.map((token) => {
      let usdValue = 0;
      if (token.symbol === "USDC") {
        // Use USDC price from Hermes API
        usdValue = token.amount * effectiveUsdcPrice;
      } else if (token.symbol === "PYTH" && pythPrice > 0) {
        usdValue = token.amount * pythPrice;
      } else if (token.symbol === "USDT") {
        // Use USDT price from Hermes API
        usdValue = token.amount * effectiveUsdtPrice;
      }
      
      return {
        ...token,
        usdValue,
      };
    });
    
    // Calculate total: SOL (already combined native + wrapped) + filtered tokens
    const solValue = daoTreasury.solBalance * effectiveSolPrice;
    const totalTokenValue = recalculatedTokenBalances.reduce(
      (sum, token) => sum + (token.usdValue || 0),
      0
    );
    const filteredDaoTreasuryValue = solValue + totalTokenValue;

    // Update DAO Treasury with filtered balances and recalculated values
    const filteredDaoTreasury: ReserveAccountInfo = {
      ...daoTreasury,
      tokenBalances: recalculatedTokenBalances,
      totalUsdValue: filteredDaoTreasuryValue,
      solPrice: effectiveSolPrice, // Use the actual SOL price from API
    };

    // Calculate totals
    const totalReserveValue =
      filteredDaoTreasury.totalUsdValue + pythianCouncilOps.totalUsdValue;

    // Calculate total PYTH held
    // Only count tokens with exact PYTH mint address from TOKEN_SYMBOLS
    const PYTH_MINT = Object.keys(TOKEN_SYMBOLS).find(
      (mint) => TOKEN_SYMBOLS[mint] === "PYTH"
    );
    const findPythBalance = (balances: TokenBalance[]): number => {
      if (!PYTH_MINT) return 0;
      const pythToken = balances.find((t) => t.mint === PYTH_MINT);
      return pythToken?.amount || 0;
    };

    const daoTreasuryPyth = findPythBalance(filteredDaoTreasury.tokenBalances);
    const councilOpsPyth = findPythBalance(pythianCouncilOps.tokenBalances);
    const totalPythHeld = daoTreasuryPyth + councilOpsPyth;

    return {
      daoTreasury: filteredDaoTreasury,
      pythianCouncilOps,
      totalReserveValue,
      totalPythHeld,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to fetch Pyth Reserve Summary: ${errorMessage}`
    );
  }
}
