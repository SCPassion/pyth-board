import type { PythStakingInfo, WalletInfo } from "@/types/pythTypes";

function isGovernanceInfo(value: unknown): value is PythStakingInfo {
  if (!value || typeof value !== "object") return false;
  const info = value as PythStakingInfo;
  const validAmounts = (row: PythStakingInfo | PythStakingInfo["stakingAccounts"][number]) =>
    [row.totalStakedPyth, row.activePyth, row.warmingUpPyth, row.unstakingPyth]
      .every(amount => typeof amount === "number" && Number.isFinite(amount) && amount >= 0);
  return info.kind === "governance" && validAmounts(info) && Array.isArray(info.stakingAccounts) &&
    info.stakingAccounts.every(account => account && typeof account.address === "string" && validAmounts(account));
}

/** Preserve saved wallets, but discard OIS balances before the governance refresh. */
export function parseStoredWallets(serialized: string | null): WalletInfo[] {
  if (!serialized) return [];
  let data: unknown;
  try { data = JSON.parse(serialized); } catch { return []; }
  if (!Array.isArray(data)) return [];
  return data.flatMap(value => {
    if (!value || typeof value.address !== "string" || !value.address || typeof value.name !== "string") return [];
    return [{
      id: typeof value.id === "string" ? value.id : value.address,
      address: value.address,
      name: value.name,
      stakingAddress: typeof value.stakingAddress === "string" ? value.stakingAddress : "",
      stakingInfo: isGovernanceInfo(value.stakingInfo) ? value.stakingInfo : null,
    }];
  });
}

export function getGovernancePortfolioTotal(wallets: WalletInfo[]): number | null {
  if (wallets.some(wallet => wallet.stakingInfo?.kind !== "governance")) return null;
  return wallets.reduce((sum, wallet) => sum + (wallet.stakingInfo?.totalStakedPyth ?? 0), 0);
}
