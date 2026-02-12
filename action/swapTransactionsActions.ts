"use server";

import { PublicKey, Connection } from "@solana/web3.js";
import { PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS, TOKEN_SYMBOLS } from "@/data/pythReserveAddresses";
import type { SwapTransaction } from "@/types/pythTypes";

// RPC endpoints with fallback support
const RPC_ENDPOINTS = [
  "https://solana-mainnet.g.alchemy.com/v2/VAWGO1qOMcxkm0B9H0xUPzpNMzBnIvo8",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-api.projectserum.com",
];

const CONNECTION_CONFIG = {
  commitment: "confirmed" as const,
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
  httpHeaders: {
    "User-Agent": "PythBoard/1.0",
  },
};

function createConnection(retryCount: number = 0): Connection {
  const endpointIndex = Math.min(retryCount, RPC_ENDPOINTS.length - 1);
  const endpoint = RPC_ENDPOINTS[endpointIndex];
  return new Connection(endpoint, CONNECTION_CONFIG);
}

// PYTH token mint address
const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

// Known swap program IDs
const SWAP_PROGRAMS = [
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter V6
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB", // Jupiter V4
  "JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph", // Jupiter V3
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP", // Orca
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Orca Whirlpools
];

/**
 * Parses a parsed transaction to check if it's a swap to PYTH
 */
function parseSwapTransactionFromParsed(
  signature: string,
  tx: Awaited<ReturnType<Connection["getParsedTransaction"]>>
): Omit<SwapTransaction, "date"> | null {
  try {
    if (!tx || !tx.meta) {
      return null;
    }

    // Check if transaction was successful
    if (tx.meta.err) {
      return null;
    }

    // Check if PYTH token was received (output)
    const postTokenBalances = tx.meta.postTokenBalances || [];
    const preTokenBalances = tx.meta.preTokenBalances || [];

    // Find PYTH token balance changes by comparing pre and post balances
    let pythReceived = 0;
    let pythPostBalance = 0; // Total PYTH balance after swap
    let inputToken = "";
    let inputAmount = 0;

    // Check all token accounts for PYTH received
    for (const postBalance of postTokenBalances) {
      if (postBalance.mint === PYTH_MINT) {
        const preBalance = preTokenBalances.find(
          (pre) =>
            pre.accountIndex === postBalance.accountIndex &&
            pre.mint === PYTH_MINT
        );

        const preAmount = preBalance?.uiTokenAmount.uiAmount || 0;
        const postAmount = postBalance.uiTokenAmount.uiAmount || 0;
        const change = postAmount - preAmount;

        if (change > 0) {
          pythReceived += change;
        }
        
        // Track total post balance (sum all PYTH token accounts)
        pythPostBalance += postAmount;
      }
    }

    // If PYTH was received, find what token was sent
    if (pythReceived > 0) {
      // Look for tokens that decreased (were sent)
      for (const preBalance of preTokenBalances) {
        if (preBalance.mint !== PYTH_MINT) {
          const postBalance = postTokenBalances.find(
            (post) =>
              post.accountIndex === preBalance.accountIndex &&
              post.mint === preBalance.mint
          );

          const preAmount = preBalance.uiTokenAmount.uiAmount || 0;
          const postAmount = postBalance?.uiTokenAmount.uiAmount || 0;
          const sent = preAmount - postAmount;

          if (sent > 0) {
            // Found the input token
            inputToken = TOKEN_SYMBOLS[preBalance.mint] || preBalance.mint.slice(0, 4) + "..." + preBalance.mint.slice(-4);
            inputAmount = sent;
            break;
          }
        }
      }
    }

    if (pythReceived <= 0 || inputAmount <= 0) {
      return null;
    }

    // Identify swap program from instructions
    let swapProgram = "Unknown";
    const instructions = tx.transaction.message.instructions;
    
    for (const ix of instructions) {
      let programId: string | null = null;
      
      if ("programId" in ix) {
        const pid = ix.programId;
        if (typeof pid === "string") {
          programId = pid;
        } else if (pid instanceof PublicKey) {
          programId = pid.toString();
        } else if (pid && typeof pid === "object") {
          // Handle object with toString method
          try {
            const pidStr = String(pid);
            if (pidStr && pidStr !== "[object Object]") {
              programId = pidStr;
            }
          } catch {
            // Ignore conversion errors
          }
        }
      }
      
      if (programId && SWAP_PROGRAMS.includes(programId)) {
        if (programId.startsWith("JUP")) {
          swapProgram = "Jupiter";
        } else if (programId.includes("675kPX") || programId.includes("CAMMC")) {
          swapProgram = "Raydium";
        } else if (programId.includes("9W959") || programId.includes("whir")) {
          swapProgram = "Orca";
        } else {
          swapProgram = programId.slice(0, 4) + "..." + programId.slice(-4);
        }
        break;
      }
    }

    const blockTime = tx.blockTime;
    const slot = tx.slot;
    
    // Note: blockTime might be null in parsed transaction
    // We'll use the blockTime from getSignaturesForAddress response instead
    // But we still need it here as a fallback
    // Don't return null if blockTime is missing - let the caller handle it

    return {
      signature,
      timestamp: blockTime || 0, // Will be overridden by signature blockTime if available
      block: slot || 0,
      inputToken,
      inputAmount,
      outputAmount: pythReceived,
      postBalance: pythPostBalance,
      swapProgram,
      explorerUrl: `https://solscan.io/tx/${signature}`,
    };
  } catch (error) {
    console.error(`Error parsing transaction ${signature}:`, error);
    return null;
  }
}

/**
 * Fetches recent swap transactions to PYTH from Pyth Council Ops wallet
 */
export interface SwapTransactionsPage {
  transactions: SwapTransaction[];
  hasMore: boolean;
  page: number;
  pageSize: number;
}

export async function getSwapTransactionsPage(
  page: number,
  pageSize: number
): Promise<SwapTransactionsPage> {
  try {
    let connection = createConnection(0);
    const councilOpsAddress = new PublicKey(PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS);

    const targetCount = page * pageSize;
    const batchLimit = 50;
    let beforeSignature: string | undefined;
    let collected: SwapTransaction[] = [];
    let hasMore = false;

    // Try with fallback endpoints
    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
      try {
        connection = createConnection(i);

        while (collected.length < targetCount) {
          const response = await connection.getSignaturesForAddress(councilOpsAddress, {
            limit: batchLimit,
            before: beforeSignature,
          });

          if (response.length === 0) {
            hasMore = false;
            break;
          }

          beforeSignature = response[response.length - 1].signature;
          hasMore = response.length === batchLimit;

          const signatureStrings = response.map((sig) => sig.signature);
          const parsed = await connection.getParsedTransactions(signatureStrings, {
            maxSupportedTransactionVersion: 0,
          });

          const parsedTransactions = parsed
            .map((parsedTx, index) => {
              const sig = response[index];
              const tx = parseSwapTransactionFromParsed(sig.signature, parsedTx);
              if (!tx) {
                return null;
              }

              let blockTime: number | null = null;
              const now = Math.floor(Date.now() / 1000);
              const oneYearAgo = now - 365 * 24 * 60 * 60;

              if (sig.blockTime !== null && sig.blockTime !== undefined && sig.blockTime > 0) {
                if (sig.blockTime <= now && sig.blockTime >= oneYearAgo) {
                  blockTime = sig.blockTime;
                }
              }

              if (!blockTime && tx.timestamp && tx.timestamp > 0) {
                if (tx.timestamp <= now && tx.timestamp >= oneYearAgo) {
                  blockTime = tx.timestamp;
                }
              }

              if (!blockTime || blockTime <= 0) {
                return null;
              }

              const transactionDate = new Date(blockTime * 1000);
              const formattedDate = new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "UTC",
                timeZoneName: "short",
              }).format(transactionDate);

              return {
                ...tx,
                timestamp: blockTime,
                date: formattedDate,
              };
            })
            .filter((tx): tx is SwapTransaction => tx !== null);

          collected = collected.concat(parsedTransactions);
        }

        break;
      } catch (error) {
        if (i === RPC_ENDPOINTS.length - 1) {
          throw error;
        }
      }
    }

    const sorted = collected.sort((a, b) => b.timestamp - a.timestamp);
    const pageStart = (page - 1) * pageSize;
    const pageEnd = pageStart + pageSize;
    const pageTransactions = sorted.slice(pageStart, pageEnd);
    const hasMorePages = sorted.length > pageEnd || hasMore;

    return {
      transactions: pageTransactions,
      hasMore: hasMorePages,
      page,
      pageSize,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching swap transactions:", errorMessage);
    return {
      transactions: [],
      hasMore: false,
      page,
      pageSize,
    };
  }
}
