"use client";

import { useWalletInfosStore } from "@/store/store";
import { WalletSection } from "@/components/wallet-section";

export default function WalletsPage() {
  const { wallets } = useWalletInfosStore();

  return (
    <div className="space-y-6">
      {wallets.map((wallet) => (
        <WalletSection key={wallet.id} wallet={wallet} />
      ))}
      {wallets.length === 0 && (
        <div className="text-center text-gray-400">
          No wallets found. Please add a wallet to view details.
        </div>
      )}
    </div>
  );
}
