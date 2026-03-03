"use client";

import {
  useEffect,
  useState,
  useCallback,
  createContext,
  useContext,
} from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { useWalletInfosStore } from "@/store/store";
import { getOISStakingInfo } from "@/action/pythActions";
import { usePythPrice } from "@/hooks/use-pyth-price";

// Create loading context
const LoadingContext = createContext<{
  isLoading: boolean;
}>({ isLoading: false });

export const useAppLoading = () => useContext(LoadingContext);

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { wallets, setWallets } = useWalletInfosStore();
  const pythPrice = usePythPrice();

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  // Load wallets from localStorage - iOS/Mobile compatible version
  useEffect(() => {
    let isMounted = true;

    // Set loading to false immediately on mount (don't block UI)
    // We'll load wallets in the background
    setIsLoading(false);

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

    // Load wallets asynchronously (don't block UI)
    // Use requestIdleCallback if available, otherwise setTimeout
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as any).requestIdleCallback(loadWallets, { timeout: 100 });
    } else {
      setTimeout(loadWallets, 0);
    }

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
    <LoadingContext.Provider value={{ isLoading }}>
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

          <main className="flex-1 overflow-auto overflow-x-hidden bg-[radial-gradient(circle_at_top_right,rgba(135,80,255,0.12),transparent_22%),linear-gradient(180deg,#261e35_0%,#251c34_100%)] p-3 sm:p-6 min-w-0">
            {isLoading && (
              <div className="fixed right-4 top-4 z-50 rounded-2xl bg-[#6f4bd8] px-4 py-2 text-white shadow-lg">
                Loading wallet data...
              </div>
            )}
            <div className="mx-auto max-w-[1360px] space-y-5">{children}</div>
          </main>
        </div>
      </div>
    </LoadingContext.Provider>
  );
}
