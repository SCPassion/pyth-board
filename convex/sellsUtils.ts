export const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

export type Tier = "shrimp" | "dolphin" | "whale";

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
  if (pythAmount > 50_000) return "whale";
  if (pythAmount >= 10_000) return "dolphin";
  return "shrimp";
}

export function toUtcDateKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().split("T")[0];
}

/**
 * Extracts sell data from a Helius enhanced webhook tokenTransfers array.
 *
 * Uses feePayer (the transaction signer) as the anchor for detection:
 * a sell is a transaction where PYTH moves OUT of the feePayer's wallet.
 * This avoids false positives from pool/vault accounts that also have
 * non-empty fromUserAccount in Jupiter aggregator routes.
 *
 * Returns null if feePayer has no PYTH outbound transfer (not a PYTH sell).
 * Falls back to toToken "unknown" / toAmount 0 if no inbound leg is found.
 */
export function extractSellData(
  tokenTransfers: TokenTransfer[],
  pythMint: string,
  feePayer: string
): SellData | null {
  // Find PYTH outbound FROM the fee payer (the user who signed the transaction)
  const pythOut = tokenTransfers.find(
    (t) => t.mint === pythMint && t.fromUserAccount === feePayer
  );
  if (!pythOut) return null;

  // Find the inbound non-PYTH leg to the fee payer
  const tokenIn = tokenTransfers.find(
    (t) => t.toUserAccount === feePayer && t.mint !== pythMint
  );

  return {
    fromAddress: feePayer,
    pythAmount: pythOut.tokenAmount,
    toToken: tokenIn?.mint ?? "unknown",
    toTokenSymbol: tokenIn?.symbol,
    toAmount: tokenIn?.tokenAmount ?? 0,
  };
}

export type BuyData = {
  // toAddress = buyer's wallet (receiving PYTH).
  // Note: storeBuyEvent stores this as fromAddress in buy_events to mirror
  // sell_events.fromAddress naming convention (both mean "swap initiator").
  toAddress: string;
  pythAmount: number;
  fromToken: string;        // token spent to buy PYTH
  fromTokenSymbol?: string;
  fromAmount: number;       // amount of fromToken spent
};

/**
 * Extracts buy data from a Helius enhanced webhook tokenTransfers array.
 *
 * Uses feePayer (the transaction signer) as the anchor for detection:
 * a buy is a transaction where PYTH moves IN to the feePayer's wallet.
 * This avoids false negatives where toUserAccount is empty for intermediate
 * accounts and avoids matching pool-to-pool PYTH transfers.
 *
 * Returns null if feePayer has no PYTH inbound transfer (not a PYTH buy).
 * Falls back to fromToken "unknown" / fromAmount 0 if no outbound leg is found.
 */
export function extractBuyData(
  tokenTransfers: TokenTransfer[],
  pythMint: string,
  feePayer: string
): BuyData | null {
  // Find PYTH inbound TO the fee payer (the user who signed the transaction)
  const pythIn = tokenTransfers.find(
    (t) => t.mint === pythMint && t.toUserAccount === feePayer
  );
  if (!pythIn) return null;

  // Find the outbound non-PYTH leg from the fee payer
  const tokenOut = tokenTransfers.find(
    (t) => t.fromUserAccount === feePayer && t.mint !== pythMint
  );

  return {
    toAddress: feePayer,
    pythAmount: pythIn.tokenAmount,
    fromToken: tokenOut?.mint ?? "unknown",
    fromTokenSymbol: tokenOut?.symbol,
    fromAmount: tokenOut?.tokenAmount ?? 0,
  };
}
