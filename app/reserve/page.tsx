"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ReserveSummary } from "@/components/reserve-summary";
import { ReserveAccountCard } from "@/components/reserve-account-card";
import { SwapTransactions } from "@/components/swap-transactions";
import { ReservePythHoldingChart } from "@/components/reserve-pyth-holding-chart";
import { getPythReserveSummary } from "@/action/pythReserveActions";
import { getSwapTransactionsPage } from "@/action/swapTransactionsActions";
import type { PythReserveSummary, SwapTransaction } from "@/types/pythTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export default function ReservePage() {
  const [activeTab, setActiveTab] = useState<"overview" | "pyth-history">(
    "overview"
  );
  const [reserveSummary, setReserveSummary] =
    useState<PythReserveSummary | null>(null);
  const [swapTransactions, setSwapTransactions] = useState<SwapTransaction[]>([]);
  const [swapPage, setSwapPage] = useState(1);
  const [swapPageSize] = useState(10);
  const [swapHasMore, setSwapHasMore] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapThrottleRemainingMs, setSwapThrottleRemainingMs] = useState(0);
  const swapCacheRef = useRef(new Map<number, SwapTransaction[]>());
  const swapHasMoreCacheRef = useRef(new Map<number, boolean>());
  const swapThrottleRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const isFetchingReserveRef = useRef(false);
  const isFetchingSwapsRef = useRef(false);

  const startSwapThrottle = useCallback(() => {
    const now = Date.now();
    swapThrottleRef.current = now;
    setSwapThrottleRemainingMs(10000);
  }, []);

  const fetchSwapPage = useCallback(
    async (page: number, force: boolean = false) => {
      const now = Date.now();
      const remaining = 10000 - (now - swapThrottleRef.current);
      if (!force && remaining > 0) {
        setSwapThrottleRemainingMs(remaining);
        return;
      }
      startSwapThrottle();

      if (!force && swapCacheRef.current.has(page)) {
        setSwapTransactions(swapCacheRef.current.get(page) || []);
        setSwapHasMore(swapHasMoreCacheRef.current.get(page) || false);
        setSwapPage(page);
        return;
      }

      if (isFetchingSwapsRef.current) {
        return;
      }

      try {
        isFetchingSwapsRef.current = true;
        setSwapLoading(true);
        setSwapError(null);
        const response = await getSwapTransactionsPage(page, swapPageSize);
        swapCacheRef.current.set(page, response.transactions);
        swapHasMoreCacheRef.current.set(page, response.hasMore);
        setSwapTransactions(response.transactions);
        setSwapHasMore(response.hasMore);
        setSwapPage(page);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch swap transactions";
        setSwapError(errorMessage);
        console.error("Error fetching swap transactions:", err);
      } finally {
        setSwapLoading(false);
        isFetchingSwapsRef.current = false;
      }
    },
    [startSwapThrottle, swapPageSize]
  );

  useEffect(() => {
    if (swapThrottleRemainingMs <= 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = 10000 - (now - swapThrottleRef.current);
      setSwapThrottleRemainingMs(remaining > 0 ? remaining : 0);
    }, 200);
    return () => clearInterval(interval);
  }, [swapThrottleRemainingMs]);

  const fetchReserveData = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (isFetchingReserveRef.current) {
      return;
    }

    try {
      isFetchingReserveRef.current = true;
      setLoading(true);
      setReserveError(null);
      const data = await getPythReserveSummary();
      setReserveSummary(data);
      hasFetchedRef.current = true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch reserve data";
      setReserveError(errorMessage);
      console.error("Error fetching reserve summary:", err);
    } finally {
      setLoading(false);
      isFetchingReserveRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Only fetch on initial mount if we haven't fetched yet
    if (!hasFetchedRef.current) {
      fetchReserveData();
      fetchSwapPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run once on mount

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400 mx-auto" />
          <p className="text-gray-400">Loading reserve data...</p>
        </div>
      </div>
    );
  }

  if (reserveError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="bg-[#2a2f3e] border-red-700 max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold text-white mb-1">Error</h3>
                <p className="text-sm text-gray-400">{reserveError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!reserveSummary) {
    return null;
  }

  return (
    <div className="space-y-6 w-full min-w-0 overflow-x-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-0">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Pyth Strategic Reserve
            </h1>
            <Badge
              variant="outline"
              className="text-yellow-400 border-yellow-600 text-xs"
            >
              BETA
            </Badge>
          </div>
          <p className="text-gray-400 text-sm sm:text-base">
            Monitor the operations and holdings of the Pyth DAO Strategic Reserve
            as per{" "}
            <a
              href="https://forum.pyth.network/t/passed-op-pip-87-pyth-token-phase-2-pyth-strategic-reserve/2293"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              OP-PIP-87
            </a>
            . Currently tracking $SOL, $PYTH, $USDC & $USDT only.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <Badge
            variant="outline"
            className="text-gray-400 border-gray-600 text-xs sm:text-sm"
          >
            {swapTransactions.length} Recent Swaps
          </Badge>
          <Button
            onClick={() => {
              swapCacheRef.current.clear();
              swapHasMoreCacheRef.current.clear();
              fetchReserveData();
              fetchSwapPage(swapPage, true);
            }}
            disabled={loading}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 w-fit justify-center self-start"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-700 pb-3">
        <Button
          size="sm"
          variant={activeTab === "overview" ? "default" : "outline"}
          className={
            activeTab === "overview"
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "text-gray-300 border-gray-600 hover:bg-[#374151]"
          }
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </Button>
        <Button
          size="sm"
          variant={activeTab === "pyth-history" ? "default" : "outline"}
          className={
            activeTab === "pyth-history"
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "text-gray-300 border-gray-600 hover:bg-[#374151]"
          }
          onClick={() => setActiveTab("pyth-history")}
        >
          PYTH Holding History
        </Button>
      </div>

      {activeTab === "overview" ? (
        <>
          {/* Summary Cards */}
          <ReserveSummary reserveSummary={reserveSummary} />

          {/* Account Details */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Reserve Accounts
              </h2>
              <Badge
                variant="outline"
                className="text-gray-400 border-gray-600 text-sm"
              >
                2 Accounts
              </Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <ReserveAccountCard accountInfo={reserveSummary.daoTreasury} />
              <ReserveAccountCard
                accountInfo={reserveSummary.pythianCouncilOps}
              />
            </div>
          </div>

          {/* Swap Transactions */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Recent Swap Operations
              </h2>
            </div>
            <SwapTransactions
              transactions={swapTransactions}
              page={swapPage}
              pageSize={swapPageSize}
              hasMore={swapHasMore}
              isLoading={swapLoading}
              throttleRemainingMs={swapThrottleRemainingMs}
              error={swapError}
              onPageChange={(page) => fetchSwapPage(page)}
            />
          </div>

          {/* Information Section */}
          <Card className="bg-[#2a2f3e] border-gray-700 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                About the Strategic Reserve
              </h3>
              <div className="space-y-2 text-gray-400 text-xs sm:text-sm">
                <p>
                  The Pyth Strategic Reserve is a DAO-owned reserve established to
                  systematically acquire PYTH tokens using protocol revenue. The
                  reserve operates under the following principles:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Monthly purchases using one-third (33%) of the Treasury balance
                  </li>
                  <li>
                    Administered by the Pythian Council Ops Multisig (6/8 approval
                    required)
                  </li>
                  <li>
                    All acquired PYTH tokens are repatriated to the DAO Treasury
                  </li>
                  <li>
                    Transactions follow strict parameters: max 5% slippage, max
                    $25,000 per transaction
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <ReservePythHoldingChart />
      )}
    </div>
  );
}
