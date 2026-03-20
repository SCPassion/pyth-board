import type { WalletInfo } from "@/types/pythTypes";

type RefreshWalletResult = {
  info: WalletInfo["stakingInfo"];
  stakingAddress: string;
};

export async function refreshWalletsSequentially(
  wallets: WalletInfo[],
  refreshWallet: (wallet: WalletInfo) => Promise<RefreshWalletResult>,
  onUpdate: (wallets: WalletInfo[]) => void
): Promise<{
  wallets: WalletInfo[];
  hadErrors: boolean;
  errorMessage: string | null;
}> {
  const refreshed = [...wallets];
  let hadErrors = false;

  for (let index = 0; index < refreshed.length; index++) {
    const wallet = refreshed[index];

    try {
      const next = await refreshWallet(wallet);
      refreshed[index] = {
        ...wallet,
        stakingAddress: next.stakingAddress,
        stakingInfo: next.info,
      };
    } catch {
      hadErrors = true;
      refreshed[index] = wallet;
    }

    onUpdate([...refreshed]);
  }

  return {
    wallets: refreshed,
    hadErrors,
    errorMessage: hadErrors
      ? "Some wallet balances could not be refreshed. Try again later."
      : null,
  };
}
