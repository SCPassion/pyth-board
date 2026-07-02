"use client";

import {
  useEffect,
  useState,
  useCallback,
} from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { useWalletInfosStore } from "@/store/store";
import { refreshOISStakingInfo } from "@/action/pythActions";
import { usePythPrice } from "@/hooks/use-pyth-price";
import { refreshWalletsSequentially } from "@/lib/wallet-refresh";
import { AppLoadingContext } from "@/components/app-loading-context";

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

  const { wallets, setWallets } = useWalletInfosStore();
  const pythPrice = usePythPrice();

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  // Load wallets from localStorage - iOS/Mobile compatible version
  useEffect(() => {
    let isMounted = true;
    setIsLoading(false);

    async function refreshWalletsInBackground(
      storedWallets: typeof wallets
    ): Promise<void> {
      if (isMounted) {
        setIsRefreshingWallets(true);
        setWalletRefreshError(null);
      }

      try {
        const result = await refreshWalletsSequentially(
          storedWallets,
          async (wallet) => {
            const next = await refreshOISStakingInfo(
              wallet.address,
              wallet.stakingAddress
            );
            return next;
          },
          (nextWallets) => {
            if (isMounted) {
              setWallets(nextWallets);
            }
          }
        );

        if (isMounted) {
          try {
            localStorage.setItem("wallets", JSON.stringify(result.wallets));
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
        if (isMounted) {
          setIsRefreshingWallets(false);
        }
      }
    }

    function loadWallets() {
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

        let wallets = [];

        if (storedWallets) {
          try {
            wallets = JSON.parse(storedWallets);
          } catch (parseError) {
            console.error("Error parsing wallet data:", parseError);
            wallets = [];
          }
        }

        if (isMounted) {
          setWallets(wallets);
        }

        if (wallets.length > 0) {
          setTimeout(() => {
            void refreshWalletsInBackground(wallets);
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

    return () => {
      isMounted = false;
    };
  }, []); // Only run on mount

  // Listen for localStorage changes (new wallets added) - SIMPLIFIED
  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key === "wallets" && event.newValue) {
        try {
          const parsedWallets = JSON.parse(event.newValue);
          setWallets(parsedWallets);
        } catch (error) {
          console.error("Error parsing wallet data from storage:", error);
        }
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []); // No dependencies to prevent loops

  // Pyth price is now handled by usePythPrice hook

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

          <main className="flex-1 overflow-auto overflow-x-hidden bg-[radial-gradient(circle_at_top_right,rgba(135,80,255,0.12),transparent_22%),linear-gradient(180deg,#261e35_0%,#251c34_100%)] p-4 sm:p-8 lg:p-12 min-w-0">
            {isLoading && (
              <div className="fixed right-4 top-4 z-50 rounded-2xl bg-[#6f4bd8] px-4 py-2 text-white shadow-lg">
                Loading wallet data...
              </div>
            )}
            <div className="mx-auto max-w-[1360px]">{children}</div>
          </main>
        </div>
      </div>
    </AppLoadingContext.Provider>
  );
}
