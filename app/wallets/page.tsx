"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { useWalletInfosStore } from "@/store/store";
import { WalletSection } from "@/components/wallet-section";
import { getOISStakingInfo } from "@/action/pythActions";

export default function WalletsPage() {
  console.log("Wallets page rendered");

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { wallets, setWallets } = useWalletInfosStore();

  const toggleMobileMenu = useCallback(() => {
    console.log("Mobile menu toggled");
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (localStorage.getItem("wallets")) {
      const storedWallets = localStorage.getItem("wallets");
      if (storedWallets) {
        const parsedWallets = JSON.parse(storedWallets);
        setWallets(parsedWallets);
      }
    } else {
      localStorage.setItem("wallets", JSON.stringify(wallets));
    }
  }, []);

  useEffect(() => {
    console.log("useEffect refreshWallets triggered");
    async function refreshWallets() {
      const storedWallets = localStorage.getItem("wallets");
      if (storedWallets && !isLoading) {
        console.log("Refreshing wallets...");
        setIsLoading(true);
        try {
          const parsedWallets = JSON.parse(storedWallets);
          // In development, reduce API calls to prevent excessive rebuilding
          if (process.env.NODE_ENV === "development") {
            console.log(
              "Skipping wallet refresh in development mode to prevent excessive API calls"
            );
            setWallets(parsedWallets);
            return;
          }

          // Fetch latest staking info for each wallet
          const updatedWallets = await Promise.all(
            parsedWallets.map(async (wallet: any) => {
              try {
                const stakingInfo = await getOISStakingInfo(
                  wallet.address,
                  wallet.stakingAddress
                );
                return { ...wallet, stakingInfo };
              } catch (e) {
                console.error(
                  `Error fetching staking info for wallet ${wallet.name}:`,
                  e
                );
                return wallet; // fallback to old info if fetch fails
              }
            })
          );
          setWallets(updatedWallets);
          localStorage.setItem("wallets", JSON.stringify(updatedWallets));
        } finally {
          setIsLoading(false);
        }
      }
    }
    refreshWallets();
  }, [setWallets]);

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
          {isLoading && (
            <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg z-50">
              Loading wallet data...
            </div>
          )}
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
