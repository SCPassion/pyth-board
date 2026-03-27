export const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

export type Tier = "shrimp" | "dolphin" | "whale";

export type TokenTransfer = {
  fromUserAccount: string;
  toUserAccount: string;
  mint: string;
  tokenAmount: number;
  symbol?: string; // present in some Helius enriched responses, absent for unknown tokens
};

export type SwapTokenBalance = {
  userAccount: string;
  mint: string;
  rawTokenAmount?: {
    tokenAmount: string;
    decimals: number;
  };
};

export type SwapEvent = {
  tokenInputs?: SwapTokenBalance[];
  tokenOutputs?: SwapTokenBalance[];
};

export type AccountTokenBalanceChange = {
  userAccount: string;
  mint: string;
  rawTokenAmount?: {
    tokenAmount: string;
    decimals: number;
  };
};

export type AccountData = {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges?: AccountTokenBalanceChange[];
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

function toUiTokenAmount(raw?: { tokenAmount: string; decimals: number }): number {
  if (!raw) return 0;
  return Number(raw.tokenAmount) / 10 ** raw.decimals;
}

function collectNetTokenChanges(accountData: AccountData[]): Map<string, Map<string, number>> {
  const byUser = new Map<string, Map<string, number>>();

  for (const account of accountData) {
    for (const change of account.tokenBalanceChanges ?? []) {
      if (!change.userAccount || !change.rawTokenAmount) continue;
      const amount = toUiTokenAmount(change.rawTokenAmount);
      const userBalances = byUser.get(change.userAccount) ?? new Map<string, number>();
      userBalances.set(change.mint, (userBalances.get(change.mint) ?? 0) + amount);
      byUser.set(change.userAccount, userBalances);
    }
  }

  return byUser;
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
  feePayer: string,
  swapEvent?: SwapEvent
): SellData | null {
  const swapSeller = swapEvent?.tokenInputs?.find(
    (t) => t.mint === pythMint && t.userAccount
  );
  if (swapSeller) {
    const tokenOut = swapEvent?.tokenOutputs?.find(
      (t) => t.userAccount === swapSeller.userAccount && t.mint !== pythMint
    );
    const tokenOutSymbol = tokenTransfers.find(
      (t) =>
        t.toUserAccount === swapSeller.userAccount &&
        t.mint === tokenOut?.mint &&
        typeof t.symbol === "string"
    )?.symbol;

    return {
      fromAddress: swapSeller.userAccount,
      pythAmount: toUiTokenAmount(swapSeller.rawTokenAmount),
      toToken: tokenOut?.mint ?? "unknown",
      toTokenSymbol: tokenOutSymbol,
      toAmount: toUiTokenAmount(tokenOut?.rawTokenAmount),
    };
  }

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
  feePayer: string,
  swapEvent?: SwapEvent,
  accountData: AccountData[] = []
): BuyData | null {
  const swapBuyer = swapEvent?.tokenOutputs?.find(
    (t) => t.mint === pythMint && t.userAccount
  );
  if (swapBuyer) {
    const tokenIn = swapEvent?.tokenInputs?.find(
      (t) => t.userAccount === swapBuyer.userAccount && t.mint !== pythMint
    );
    const tokenInSymbol = tokenTransfers.find(
      (t) =>
        t.fromUserAccount === swapBuyer.userAccount &&
        t.mint === tokenIn?.mint &&
        typeof t.symbol === "string"
    )?.symbol;

    return {
      toAddress: swapBuyer.userAccount,
      pythAmount: toUiTokenAmount(swapBuyer.rawTokenAmount),
      fromToken: tokenIn?.mint ?? "unknown",
      fromTokenSymbol: tokenInSymbol,
      fromAmount: toUiTokenAmount(tokenIn?.rawTokenAmount),
    };
  }

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

  if (!pythIn) {
    return extractBuyDataFromAccountData(tokenTransfers, pythMint, accountData);
  }

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

export function extractBuyDataFromAccountData(
  tokenTransfers: TokenTransfer[],
  pythMint: string,
  accountData: AccountData[]
): BuyData | null {
  const netChanges = collectNetTokenChanges(accountData);

  for (const [userAccount, mintChanges] of netChanges.entries()) {
    const pythDelta = mintChanges.get(pythMint) ?? 0;
    if (pythDelta <= 0) continue;

    const spentToken = [...mintChanges.entries()].find(
      ([mint, amount]) => mint !== pythMint && amount < 0
    );

    const spentMint = spentToken?.[0] ?? "unknown";
    const spentAmount = spentToken ? Math.abs(spentToken[1]) : 0;
    const spentSymbol = tokenTransfers.find(
      (t) => t.fromUserAccount === userAccount && t.mint === spentMint && typeof t.symbol === "string"
    )?.symbol;

    return {
      toAddress: userAccount,
      pythAmount: pythDelta,
      fromToken: spentMint,
      fromTokenSymbol: spentSymbol,
      fromAmount: spentAmount,
    };
  }

  return null;
}
