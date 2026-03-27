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
 * The buyer identity is derived from the PYTH inbound transfer entry
 * (toUserAccount). Returns null if no PYTH inbound transfer is found.
 *
 * Known limitation: uses .find() so returns the first matching PYTH-inbound
 * transfer. In aggregator/multi-hop routes, the first PYTH inbound entry may
 * be into a program-owned intermediate account rather than the end user's wallet.
 * The toUserAccount !== "" guard does not distinguish program accounts from user
 * wallets. This is an accepted limitation — same structural constraint as
 * extractSellData.
 *
 * Falls back to fromToken "unknown" / fromAmount 0 if no outbound leg is found.
 */
export function extractBuyData(
  tokenTransfers: TokenTransfer[],
  pythMint: string
): BuyData | null {
  // Find PYTH inbound — PYTH arriving at a non-empty user account
  const pythIn = tokenTransfers.find(
    (t) => t.mint === pythMint && t.toUserAccount !== ""
  );
  if (!pythIn) return null;

  const buyerAddress = pythIn.toUserAccount;

  // Find the outbound non-PYTH leg from the buyer's account
  const tokenOut = tokenTransfers.find(
    (t) => t.fromUserAccount === buyerAddress && t.mint !== pythMint
  );

  return {
    toAddress: buyerAddress,
    pythAmount: pythIn.tokenAmount,
    fromToken: tokenOut?.mint ?? "unknown",
    fromTokenSymbol: tokenOut?.symbol,
    fromAmount: tokenOut?.tokenAmount ?? 0,
  };
}
