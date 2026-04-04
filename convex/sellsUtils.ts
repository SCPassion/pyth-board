export const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

export type Tier = "shrimp" | "dolphin" | "whale";
export type Direction = "buy" | "sell";

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

export type TokenTransfer = {
  fromUserAccount?: string;
  toUserAccount?: string;
  mint: string;
  tokenAmount: number;
};

export type PythEventCandidate = {
  walletAddress: string;
  direction: Direction;
  pythAmount: number;
  matchedVia: "swap_transfers" | "net_delta";
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

function collectNetPythChanges(accountData: AccountData[], pythMint: string) {
  const byWallet = new Map<string, number>();

  for (const account of accountData) {
    for (const change of account.tokenBalanceChanges ?? []) {
      if (change.mint !== pythMint || !change.userAccount || !change.rawTokenAmount) continue;
      const delta = toUiTokenAmount(change.rawTokenAmount);
      byWallet.set(change.userAccount, (byWallet.get(change.userAccount) ?? 0) + delta);
    }
  }

  return byWallet;
}

function collectTransferDrivenEvents(tokenTransfers: TokenTransfer[], pythMint: string) {
  const byWallet = new Map<
    string,
    { pythIn: number; pythOut: number; otherIn: number; otherOut: number }
  >();

  const entryFor = (wallet: string) => {
    let entry = byWallet.get(wallet);
    if (!entry) {
      entry = { pythIn: 0, pythOut: 0, otherIn: 0, otherOut: 0 };
      byWallet.set(wallet, entry);
    }
    return entry;
  };

  for (const transfer of tokenTransfers) {
    if (!transfer.tokenAmount || !Number.isFinite(transfer.tokenAmount)) continue;
    const amount = Math.abs(transfer.tokenAmount);
    const isPyth = transfer.mint === pythMint;

    if (transfer.fromUserAccount && transfer.toUserAccount && transfer.fromUserAccount === transfer.toUserAccount) {
      continue;
    }

    if (transfer.fromUserAccount) {
      const entry = entryFor(transfer.fromUserAccount);
      if (isPyth) entry.pythOut += amount;
      else entry.otherOut += amount;
    }

    if (transfer.toUserAccount) {
      const entry = entryFor(transfer.toUserAccount);
      if (isPyth) entry.pythIn += amount;
      else entry.otherIn += amount;
    }
  }

  const events: PythEventCandidate[] = [];
  for (const [walletAddress, flows] of byWallet.entries()) {
    if (flows.pythIn > 0 && flows.otherOut > 0 && flows.otherIn === 0) {
      events.push({
        walletAddress,
        direction: "buy",
        pythAmount: flows.pythIn,
        matchedVia: "swap_transfers",
      });
    }

    if (flows.pythOut > 0 && flows.otherIn > 0 && flows.otherOut === 0) {
      events.push({
        walletAddress,
        direction: "sell",
        pythAmount: flows.pythOut,
        matchedVia: "swap_transfers",
      });
    }
  }

  return events.sort((a, b) =>
    a.walletAddress === b.walletAddress
      ? a.direction.localeCompare(b.direction)
      : a.walletAddress.localeCompare(b.walletAddress)
  );
}

export function extractPythEvents(
  accountData: AccountData[],
  tokenTransfers: TokenTransfer[],
  pythMint: string,
  options?: {
    feePayer?: string;
  }
): PythEventCandidate[] {
  const transferEvents = collectTransferDrivenEvents(tokenTransfers, pythMint);
  const feePayer = options?.feePayer;

  if (feePayer) {
    const feePayerTransferEvents = transferEvents.filter((event) => event.walletAddress === feePayer);
    if (feePayerTransferEvents.length > 0) {
      return feePayerTransferEvents;
    }
  }

  if (transferEvents.length === 1) {
    return transferEvents;
  }

  const deltas = [...collectNetPythChanges(accountData, pythMint).entries()].filter(
    ([, delta]) => delta !== 0
  );

  if (deltas.length === 0) return [];

  if (feePayer) {
    const feePayerDelta = new Map(deltas).get(feePayer) ?? 0;
    if (feePayerDelta !== 0) {
      return [
        {
          walletAddress: feePayer,
          direction: (feePayerDelta > 0 ? "buy" : "sell") as Direction,
          pythAmount: Math.abs(feePayerDelta),
          matchedVia: "net_delta",
        },
      ];
    }
  }

  if (deltas.length === 1) {
    const [walletAddress, delta] = deltas[0];
    return [
      {
        walletAddress,
        direction: (delta > 0 ? "buy" : "sell") as Direction,
        pythAmount: Math.abs(delta),
        matchedVia: "net_delta",
      },
    ];
  }

  const positiveDeltas = deltas.filter(([, delta]) => delta > 0);
  const negativeDeltas = deltas.filter(([, delta]) => delta < 0);
  if (positiveDeltas.length === 1 && negativeDeltas.length === 1) {
    const [walletAddress, delta] = positiveDeltas[0];
    return [
      {
        walletAddress,
        direction: "buy",
        pythAmount: delta,
        matchedVia: "net_delta",
      },
    ];
  }

  return [];
}
