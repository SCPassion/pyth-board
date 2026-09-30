"use client";

import {
  useEffect,
  useState,
  useCallback,
} from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { AppFooter } from "@/components/app-footer";
import { useWalletInfosStore } from "@/store/store";
import { refreshGovernanceStakingInfo } from "@/action/pythActions";
import { parseStoredWallets } from "@/lib/wallet-storage";
import { refreshWalletsSequentially } from "@/lib/wallet-refresh";
import { AppLoadingContext } from "@/components/app-loading-context";
import type { WalletInfo } from "@/types/pythTypes";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingWallets, setIsRefreshingWallets] = useState(false);
  const [lastWalletRefreshAt, setLastWalletRefreshAt] = useState<number | null>(
    null
  );
  const [walletRefreshError, setWalletRefreshError] = useState<string | null>(
    null
  );

  const { setWallets } = useWalletInfosStore();

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  // Load wallets from localStorage - iOS/Mobile compatible version
  useEffect(() => {
    let isMounted = true;
    let refreshGeneration = 0;
    setIsLoading(false);

    async function refreshWalletsInBackground(
      storedWallets: WalletInfo[],
      generation: number
    ): Promise<void> {
      const isCurrent = () => isMounted && generation === refreshGeneration;
      if (!isCurrent()) return;
      if (isCurrent()) {
        setIsRefreshingWallets(true);
        setWalletRefreshError(null);
      }

      try {
        const result = await refreshWalletsSequentially(
          storedWallets,
          async (wallet) => {
            const next = await refreshGovernanceStakingInfo(wallet.address);
            return next;
          },
          (nextWallets) => {
            if (isCurrent()) {
              const updatedById = new Map(nextWallets.map(wallet => [wallet.id, wallet]));
              setWallets(useWalletInfosStore.getState().wallets.map(wallet => updatedById.get(wallet.id) ?? wallet));
            }
          }
        );

        if (isCurrent()) {
          try {
            localStorage.setItem("wallets", JSON.stringify(useWalletInfosStore.getState().wallets));
          } catch {
            // localStorage might be unavailable
          }

          if (result.hadErrors) {
            setWalletRefreshError(result.errorMessage);
          } else {
            setLastWalletRefreshAt(Date.now());
          }
        }
      } finally {
        if (isCurrent()) {
          setIsRefreshingWallets(false);
        }
      }
    }

    function loadWallets(refresh = true) {
      const generation = ++refreshGeneration;
      setIsRefreshingWallets(false);
      // Check if we're in a browser environment
      if (typeof window === "undefined") {
        return;
      }

      try {
        // Try to access localStorage with error handling for iOS private browsing
        let storedWallets: string | null = null;
        try {
          storedWallets = localStorage.getItem("wallets");
        } catch (storageError) {
          // iOS Safari private browsing mode or storage disabled
          console.warn("localStorage not available:", storageError);
          if (isMounted) {
            setWallets([]);
          }
          return;
        }

        const wallets = parseStoredWallets(storedWallets);

        if (isMounted) {
          setWallets(wallets);
        }

        if (refresh && wallets.length > 0) {
          setTimeout(() => {
            void refreshWalletsInBackground(wallets, generation);
          }, 0);
        }

        // Try to initialize localStorage if empty (but don't fail if it's disabled)
        if (!storedWallets) {
          try {
            localStorage.setItem("wallets", JSON.stringify([]));
          } catch (setError) {
            // localStorage might be disabled, that's okay
            console.warn("Could not initialize localStorage:", setError);
          }
        }
      } catch (error) {
        console.error("Error loading wallets:", error);
        if (isMounted) {
          setWallets([]);
        }
      }
    }

    loadWallets();
    function handleStorageChange(event: StorageEvent) {
      // Adopt another tab's snapshot without writing it back and triggering a refresh loop.
      if (event.key === "wallets" || event.key === null) loadWallets(false);
    }
    window.addEventListener("storage", handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [setWallets]);

  return (
    <AppLoadingContext.Provider
      value={{
        isLoading,
        isRefreshingWallets,
        lastWalletRefreshAt,
        walletRefreshError,
      }}
    >
      <div className="flex h-screen overflow-x-hidden bg-[#261e35]">
        <Sidebar
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuToggle={toggleMobileMenu}
        />

        <div className="flex min-w-0 flex-1 flex-col md:ml-0">
          <TopHeader
            isMobileMenuOpen={isMobileMenuOpen}
            onMobileMenuToggle={toggleMobileMenu}
          />

          <main className="min-w-0 flex-1 overflow-auto overflow-x-hidden bg-[radial-gradient(circle_at_top_right,rgba(135,80,255,0.12),transparent_22%),linear-gradient(180deg,#261e35_0%,#251c34_100%)] p-4 sm:p-8 lg:p-12">
            {isLoading && (
              <div className="fixed right-4 top-4 z-50 rounded-2xl bg-[#6f4bd8] px-4 py-2 text-white shadow-lg">
                Loading wallet data...
              </div>
            )}
            <div className="mx-auto max-w-[1360px]">
              {children}
              <AppFooter className="-mx-4 mt-12 shadow-none sm:hidden" />
            </div>
          </main>

          <AppFooter className="hidden md:block" />
        </div>
      </div>
    </AppLoadingContext.Provider>
  );
}
