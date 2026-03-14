"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ReserveSummary } from "@/components/reserve-summary";
import { ReserveAccountCard } from "@/components/reserve-account-card";
import { ReserveBuybackSummary } from "@/components/reserve-buyback-summary";
import { SwapTransactions } from "@/components/swap-transactions";
import { ReservePythHoldingChart } from "@/components/reserve-pyth-holding-chart";
import {
  getCurrentPythPriceUsd,
  getPythReserveSummary,
} from "@/action/pythReserveActions";
import { getSwapTransactionsPage } from "@/action/swapTransactionsActions";
import { getJupiterDcaCouncilOps } from "@/action/jupiterDcaActions";
import { getDcaCardHref } from "@/components/jupiter-dca-card";
import type {
  PythReserveSummary,
  SwapTransaction,
  JupiterDcaCouncilOpsStatus,
} from "@/types/pythTypes";
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
  const [dcaStatus, setDcaStatus] =
    useState<JupiterDcaCouncilOpsStatus | null>(null);
  const [currentPythPriceUsd, setCurrentPythPriceUsd] = useState(0);
  const [dcaLoading, setDcaLoading] = useState(true);
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
      setDcaLoading(true);
      const [data, dca, pythPriceUsd] = await Promise.all([
        getPythReserveSummary(),
        getJupiterDcaCouncilOps(),
        getCurrentPythPriceUsd(),
      ]);
      setReserveSummary(data);
      setDcaStatus(dca);
      setCurrentPythPriceUsd(pythPriceUsd);
      hasFetchedRef.current = true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch reserve data";
      setReserveError(errorMessage);
      console.error("Error fetching reserve summary:", err);
    } finally {
      setLoading(false);
      setDcaLoading(false);
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
      <div className="space-y-5 w-full min-w-0 overflow-x-hidden px-1 sm:px-2 lg:px-3">
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(47,34,82,0.96)_0%,rgba(93,47,141,0.88)_54%,rgba(181,88,152,0.72)_100%)] px-6 py-7 shadow-[0_28px_70px_rgba(9,5,20,0.28)] sm:px-8">
          <div className="pointer-events-none absolute -right-8 top-2 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-28px] left-[38%] h-24 w-24 rounded-full bg-cyan-300/15 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
            <div className="space-y-3">
              <div className="h-8 w-64 animate-pulse rounded-2xl bg-white/18" />
              <div className="h-4 w-[32rem] max-w-full animate-pulse rounded-xl bg-white/12" />
              <div className="h-4 w-[26rem] max-w-full animate-pulse rounded-xl bg-white/12" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-24 animate-pulse rounded-xl bg-white/14" />
              <div className="flex h-10 items-center rounded-2xl bg-[#23144d] px-4 text-white/80">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-center gap-2 rounded-[24px] border border-white/8 bg-[#312940] p-2">
          <div className="h-10 w-24 animate-pulse rounded-2xl bg-white/10" />
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-white/10" />
        </div>

        <section className="grid gap-5 lg:grid-cols-2">
          {[1, 2].map((index) => (
            <div
              key={index}
              className="rounded-[28px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[0_20px_50px_rgba(9,5,20,0.18)] sm:p-6"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-2xl bg-white/10" />
                    <div className="space-y-2">
                      <div className="h-6 w-44 animate-pulse rounded-2xl bg-white/12" />
                      <div className="h-4 w-32 animate-pulse rounded-xl bg-white/10" />
                    </div>
                  </div>
                  <div className="h-5 w-5 animate-pulse rounded bg-white/10" />
                </div>
                <div className="h-28 animate-pulse rounded-[22px] bg-[#312940]" />
                <div className="space-y-3">
                  <div className="h-4 w-28 animate-pulse rounded-xl bg-white/10" />
                  <div className="h-16 animate-pulse rounded-[20px] bg-[#312940]" />
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (reserveError) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="max-w-md rounded-[28px] border-red-500/25 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold text-white mb-1">Error</h3>
                <p className="text-sm text-[#b4aec8]">{reserveError}</p>
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
    <div className="space-y-5 w-full min-w-0 overflow-x-hidden px-1 sm:px-2 lg:px-3">
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(47,34,82,0.96)_0%,rgba(93,47,141,0.88)_54%,rgba(181,88,152,0.72)_100%)] px-6 py-7 shadow-[0_28px_70px_rgba(9,5,20,0.28)] sm:px-8">
        <div className="pointer-events-none absolute -right-8 top-2 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-28px] left-[38%] h-24 w-24 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                Pyth Strategic Reserve
              </h1>
              <Badge
                variant="outline"
                className="rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/85"
              >
                BETA
              </Badge>
            </div>
            <p className="max-w-3xl text-sm text-white/80 sm:text-base sm:leading-7">
              Monitor the operations and holdings of the Pyth DAO Strategic Reserve
              as per{" "}
              <a
                href="https://forum.pyth.network/t/passed-op-pip-87-pyth-token-phase-2-pyth-strategic-reserve/2293"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-white underline underline-offset-4"
              >
                OP-PIP-87
              </a>
              . Currently tracking $SOL, $PYTH, $USDC & $USDT only.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            <Badge
              variant="outline"
              className="rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/85 sm:text-sm"
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
              className="h-10 rounded-2xl bg-[#23144d] px-4 text-white hover:bg-[#2d1b5d]"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-center gap-2 rounded-[24px] border border-white/8 bg-[#312940] p-2">
        <Button
          size="sm"
          variant={activeTab === "overview" ? "default" : "ghost"}
          className={
            activeTab === "overview"
              ? "h-10 rounded-2xl bg-[#6f4bd8] px-4 text-white hover:bg-[#7b57e3]"
              : "h-10 rounded-2xl px-4 text-[#b4aec8] hover:bg-white/5 hover:text-white"
          }
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </Button>
        <Button
          size="sm"
          variant={activeTab === "pyth-history" ? "default" : "ghost"}
          className={
            activeTab === "pyth-history"
              ? "h-10 rounded-2xl bg-[#6f4bd8] px-4 text-white hover:bg-[#7b57e3]"
              : "h-10 rounded-2xl px-4 text-[#b4aec8] hover:bg-white/5 hover:text-white"
          }
          onClick={() => setActiveTab("pyth-history")}
        >
          PYTH Holding History
        </Button>
      </div>

      {activeTab === "overview" ? (
        <>
          <ReserveSummary
            reserveSummary={reserveSummary}
            dcaVaultUsdc={dcaStatus?.usdcBalanceVault ?? 0}
          />

          <ReserveBuybackSummary />

          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Reserve Accounts
              </h2>
              <Badge
                variant="outline"
                className="rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-sm text-[#b8b0d0]"
              >
                2 Accounts
              </Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              <ReserveAccountCard accountInfo={reserveSummary.daoTreasury} />
              <ReserveAccountCard
                accountInfo={reserveSummary.pythianCouncilOps}
                jupiterDca={{
                  usingDca: dcaStatus?.usingDca ?? false,
                  usdcBalanceVault: dcaStatus?.usdcBalanceVault ?? 0,
                  vaultUrl: getDcaCardHref(dcaStatus),
                }}
                dcaLoading={dcaLoading}
              />
            </div>
          </div>

          <div className="space-y-5">
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

          <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                About the Strategic Reserve
              </h3>
              <div className="space-y-2 text-[#b4aec8] text-xs sm:text-sm">
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
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-4 shadow-[0_20px_50px_rgba(9,5,20,0.18)] sm:p-5">
          <ReservePythHoldingChart currentPythPriceUsd={currentPythPriceUsd} />
        </div>
      )}
    </div>
  );
}
