export const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

export type Tier = "significant" | "large" | "whale";

export type TokenTransfer = {
  fromUserAccount: string;
  toUserAccount: string;
  mint: string;
  tokenAmount: number;
  symbol?: string; // present in some Helius enriched responses, absent for unknown tokens
};

export type SellData = {
  fromAddress: string;
  pythAmount: number;
  toToken: string;
  toTokenSymbol?: string;
  toAmount: number;
};

export function assignTier(pythAmount: number): Tier {
  if (pythAmount >= 1_000_000) return "whale";
  if (pythAmount >= 100_000) return "large";
  return "significant";
}

export function toUtcDateKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().split("T")[0];
}

/**
 * Extracts sell data from a Helius enhanced webhook tokenTransfers array.
 *
 * The seller identity is derived from the PYTH outbound transfer entry
 * (fromUserAccount), NOT from feePayer — in Jupiter swaps the fee payer
 * may be a relayer or program-owned account.
 *
 * Returns null if no PYTH outbound transfer is found (not a PYTH sell).
 * Falls back to toToken "unknown" / toAmount 0 if no inbound leg is found.
 */
export function extractSellData(
  tokenTransfers: TokenTransfer[],
  pythMint: string
): SellData | null {
  // Find PYTH outbound — PYTH leaving a user account
  const pythOut = tokenTransfers.find(
    (t) => t.mint === pythMint && t.fromUserAccount !== ""
  );
  if (!pythOut) return null;

  const sellerAddress = pythOut.fromUserAccount;

  // Find the inbound leg — any non-PYTH token arriving at the seller's account
  const tokenIn = tokenTransfers.find(
    (t) => t.toUserAccount === sellerAddress && t.mint !== pythMint
  );

  return {
    fromAddress: sellerAddress,
    pythAmount: pythOut.tokenAmount,
    toToken: tokenIn?.mint ?? "unknown",
    toTokenSymbol: tokenIn?.symbol,
    toAmount: tokenIn?.tokenAmount ?? 0,
  };
}
