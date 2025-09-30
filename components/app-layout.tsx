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
import { getPythPrice, getOISStakingInfo } from "@/action/pythActions";

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
  const [pythPrice, setPythPrice] = useState<number | null>(null);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  // Load wallets from localStorage - SIMPLIFIED VERSION
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    function loadWallets() {
      try {
        const storedWallets = localStorage.getItem("wallets");
        let wallets = [];

        if (storedWallets) {
          wallets = JSON.parse(storedWallets);
        } else {
          localStorage.setItem("wallets", JSON.stringify([]));
        }

        if (isMounted) {
          setWallets(wallets);
        }
      } catch (error) {
        console.error("Error loading wallets:", error);
        if (isMounted) {
          setWallets([]);
          localStorage.setItem("wallets", JSON.stringify([]));
        }
      } finally {
        // Always set loading to false after a short delay
        timeoutId = setTimeout(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        }, 1000);
      }
    }

    loadWallets();

    // Emergency timeout to prevent infinite loading
    const emergencyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("Emergency timeout: Forcing loading to false");
        setIsLoading(false);
      }
    }, 10000); // 10 second emergency timeout

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      clearTimeout(emergencyTimeout);
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

  // Fetch Pyth price
  useEffect(() => {
    async function getPrice() {
      const price = await getPythPrice();
      price && setPythPrice(price);
    }

    getPrice();
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading }}>
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
            {children}
          </main>
        </div>
      </div>
    </LoadingContext.Provider>
  );
}
