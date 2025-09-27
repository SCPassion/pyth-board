"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { useWalletInfosStore } from "@/store/store";
import { WalletSection } from "@/components/wallet-section";

export default function WalletsPage() {
  console.log("Wallets page rendered");

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { wallets } = useWalletInfosStore();

  const toggleMobileMenu = useCallback(() => {
    console.log("Mobile menu toggled");
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuToggle={toggleMobileMenu}
      />

      <div className="flex-1 flex flex-col md:ml-0">
        <TopHeader
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuToggle={toggleMobileMenu}
        />

        <main className="flex-1 overflow-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
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
        </main>
      </div>
    </div>
  );
}
