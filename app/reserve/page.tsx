"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ReserveSummary } from "@/components/reserve-summary";
import { ReserveAccountCard } from "@/components/reserve-account-card";
import { SwapTransactions } from "@/components/swap-transactions";
import { getPythReserveSummary } from "@/action/pythReserveActions";
import { getSwapTransactions } from "@/action/swapTransactionsActions";
import type { PythReserveSummary, SwapTransaction } from "@/types/pythTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export default function ReservePage() {
  const [reserveSummary, setReserveSummary] =
    useState<PythReserveSummary | null>(null);
  const [swapTransactions, setSwapTransactions] = useState<SwapTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  const fetchReserveData = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);
      const [data, swaps] = await Promise.all([
        getPythReserveSummary(),
        getSwapTransactions(),
      ]);
      setReserveSummary(data);
      setSwapTransactions(swaps);
      hasFetchedRef.current = true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch reserve data";
      setError(errorMessage);
      console.error("Error fetching reserve summary:", err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Only fetch on initial mount if we haven't fetched yet
    if (!hasFetchedRef.current) {
      fetchReserveData();
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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="bg-[#2a2f3e] border-red-700 max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold text-white mb-1">Error</h3>
                <p className="text-sm text-gray-400">{error}</p>
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
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-gray-400 border-gray-600 text-sm"
          >
            {swapTransactions.length} Recent Swaps
          </Badge>
          <Button
            onClick={fetchReserveData}
            disabled={loading}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <ReserveSummary reserveSummary={reserveSummary} />

      {/* Account Details */}
      <div className="space-y-4">
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
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Recent Swap Operations
          </h2>
        </div>
        <SwapTransactions transactions={swapTransactions} />
      </div>

      {/* Information Section */}
      <Card className="bg-[#2a2f3e] border-gray-600 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            About the Strategic Reserve
          </h3>
          <div className="space-y-2 text-gray-400 text-sm">
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
    </div>
  );
}

