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
 * Uses feePayer (the transaction signer) as the buyer identity — the person
 * who initiated and signed the transaction is always the buyer.
 *
 * Primary detection: PYTH arriving directly at feePayer's wallet
 * (toUserAccount === feePayer).
 *
 * Fallback: toUserAccount may be empty or unresolved in some routing patterns
 * (e.g. SOL→PYTH where the outbound leg is native SOL not an SPL token, or
 * multi-hop aggregator routes). In that case, any PYTH inbound transfer that
 * did NOT come FROM feePayer is the buy leg — we know feePayer didn't send it
 * because extractSellData already ruled that out upstream. Prefer transfers
 * where toUserAccount is non-empty (a real user wallet) over fully anonymous
 * pool-to-pool hops.
 *
 * The buyer address is always feePayer regardless of which transfer is found.
 * Falls back to fromToken "unknown" / fromAmount 0 for native SOL spends
 * (SOL does not appear in tokenTransfers, only in nativeTransfers).
 */
export function extractBuyData(
  tokenTransfers: TokenTransfer[],
  pythMint: string,
  feePayer: string
): BuyData | null {
  // Primary: PYTH arriving directly at feePayer's wallet
  let pythIn = tokenTransfers.find(
    (t) => t.mint === pythMint && t.toUserAccount === feePayer
  );

  // Fallback: find any PYTH inbound not sent by feePayer.
  // toUserAccount may be empty for some routing patterns (native SOL→PYTH,
  // multi-hop aggregators). Prefer transfers going to a named user wallet.
  if (!pythIn) {
    pythIn =
      tokenTransfers.find(
        (t) =>
          t.mint === pythMint &&
          t.toUserAccount !== "" &&
          t.fromUserAccount !== feePayer
      ) ??
      tokenTransfers.find(
        (t) => t.mint === pythMint && t.fromUserAccount !== feePayer
      );
  }

  if (!pythIn) return null;

  // Find the outbound non-PYTH SPL token leg from feePayer (e.g. USDC, wSOL).
  // Will be "unknown" / 0 for native SOL spends.
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
