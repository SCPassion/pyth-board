"use client";

import { useWalletInfosStore } from "@/store/store";
import { WalletSection } from "@/components/wallet-section";
import { Wallet, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function WalletsPage() {
  const { wallets } = useWalletInfosStore();

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Connected Wallets
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Manage your connected wallets and view staking details
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-gray-400 border-gray-600 text-sm"
          >
            {wallets.length} Wallets Connected
          </Badge>
        </div>
      </div>

      {/* Wallets Content */}
      {wallets.length === 0 ? (
        <div className="text-center py-12 sm:py-16 px-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 bg-gray-800 rounded-full flex items-center justify-center">
            <Wallet className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3">
            No Wallets Connected
          </h3>
          <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto mb-6">
            Connect your wallet to start staking PYTH and view your portfolio
            details.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {wallets.map((wallet) => (
            <WalletSection key={wallet.id} wallet={wallet} />
          ))}
        </div>
      )}
    </div>
  );
}
