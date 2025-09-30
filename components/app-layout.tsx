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

  // Load wallets from localStorage and refresh data
  useEffect(() => {
    async function loadAndRefreshWallets() {
      try {
        const storedWallets = localStorage.getItem("wallets");
        if (storedWallets) {
          const parsedWallets = JSON.parse(storedWallets);
          setWallets(parsedWallets);

          // Only refresh data if not in development mode and we have wallets
          if (
            process.env.NODE_ENV !== "development" &&
            parsedWallets.length > 0
          ) {
            try {
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
            } catch (error) {
              console.error("Error refreshing wallet data:", error);
            }
          }
        } else {
          localStorage.setItem("wallets", JSON.stringify([]));
        }
      } catch (error) {
        console.error("Error loading wallets:", error);
        // Set empty wallets on error
        setWallets([]);
        localStorage.setItem("wallets", JSON.stringify([]));
      } finally {
        // Add a small delay to ensure skeleton is visible
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Set loading to false after data is loaded
        setIsLoading(false);
      }
    }

    loadAndRefreshWallets();
  }, []); // Only run on mount

  // Listen for localStorage changes (new wallets added)
  useEffect(() => {
    let isRefreshing = false; // Prevent multiple simultaneous refreshes

    function handleStorageChange(event: StorageEvent) {
      if (event.key === "wallets" && event.newValue && !isRefreshing) {
        const parsedWallets = JSON.parse(event.newValue);

        // Only update if wallets actually changed
        const currentWallets = useWalletInfosStore.getState().wallets;
        if (JSON.stringify(currentWallets) !== JSON.stringify(parsedWallets)) {
          setWallets(parsedWallets);

          // Refresh data for new wallets only in production
          if (process.env.NODE_ENV !== "development" && !isLoading) {
            isRefreshing = true;
            setIsLoading(true);

            Promise.all(
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
                  return wallet;
                }
              })
            )
              .then((updatedWallets) => {
                setWallets(updatedWallets);
                localStorage.setItem("wallets", JSON.stringify(updatedWallets));
                setIsLoading(false);
                isRefreshing = false;
              })
              .catch((error) => {
                console.error("Error refreshing wallet data:", error);
                setIsLoading(false);
                isRefreshing = false;
              });
          }
        }
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [isLoading]);

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
