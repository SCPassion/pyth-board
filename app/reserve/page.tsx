"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ReserveSummary } from "@/components/reserve-summary";
import { ReserveAccountCard } from "@/components/reserve-account-card";
import { SwapTransactions } from "@/components/swap-transactions";
import { ReservePythHoldingChart } from "@/components/reserve-pyth-holding-chart";
import { ReservePythBoughtChart } from "@/components/reserve-pyth-bought-chart";
import {
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
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { SectionRule } from "@/components/section-rule";

export default function ReservePage() {
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
      const [data, dca] = await Promise.all([
        getPythReserveSummary(),
        getJupiterDcaCouncilOps(),
      ]);
      setReserveSummary(data);
      setDcaStatus(dca);
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
      <div className="w-full min-w-0 space-y-8 overflow-x-hidden">
        <div className="space-y-4 border-b border-white/10 pb-6">
          <div className="h-3 w-40 animate-pulse rounded-full bg-white/10" />
          <div className="h-9 w-72 animate-pulse rounded-2xl bg-white/12" />
          <div className="h-4 w-full max-w-2xl animate-pulse rounded-xl bg-white/8" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {[1, 2].map((index) => (
            <div
              key={index}
              className="rounded-[28px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[0_20px_50px_rgba(9,5,20,0.18)] sm:p-6"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded-full bg-white/10" />
                  <div className="h-6 w-52 animate-pulse rounded-2xl bg-white/12" />
                </div>
                <div className="h-16 animate-pulse rounded-[20px] bg-[#312940]" />
                <div className="h-56 animate-pulse rounded-[22px] bg-[#312940]" />
              </div>
            </div>
          ))}
        </div>
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
    <div className="w-full min-w-0 space-y-10 overflow-x-hidden">
      {/* Masthead */}
      <header className="relative border-b border-white/10 pb-7">
        <div
          aria-hidden
          className="absolute -top-1 left-0 h-px w-full bg-gradient-to-r from-cyan-400/70 via-fuchsia-400/60 to-transparent"
        />
        <div className="flex flex-col gap-6 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p
              className={`font-data text-[11px] uppercase tracking-[0.32em] text-cyan-300/70`}
            >
              Strategic Reserve &middot; OP&#8209;PIP&#8209;87
            </p>
            <h1
              className={`font-display text-3xl italic text-white sm:text-4xl lg:text-5xl`}
            >
              Pyth Strategic Reserve
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              A DAO-owned ledger of Pyth&apos;s{" "}
              <a
                href="https://forum.pyth.network/t/passed-op-pip-87-pyth-token-phase-2-pyth-strategic-reserve/2293"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                treasury-funded buyback program
              </a>
              , tracking $SOL, $PYTH, $USDC &amp; $USDT holdings in real time.
            </p>
          </div>

          <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-3">
            <div className={`font-data text-right`}>
              <div className="flex items-center justify-end gap-1.5 text-[11px] text-emerald-300/90">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                LIVE
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                {swapTransactions.length.toString().padStart(2, "0")} swaps
                tracked
              </p>
            </div>
            <button
              onClick={() => {
                swapCacheRef.current.clear();
                swapHasMoreCacheRef.current.clear();
                fetchReserveData();
                fetchSwapPage(swapPage, true);
              }}
              disabled={loading}
              className={`font-data group flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/80 transition-colors hover:border-white/35 hover:text-white disabled:opacity-50`}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : "transition-transform group-hover:rotate-90"}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* 01 — Reserve Summary */}
      <section className="space-y-5">
        <SectionRule index="01" title="Reserve Summary" />
        <ReserveSummary
          reserveSummary={reserveSummary}
          dcaVaultUsdc={dcaStatus?.usdcBalanceVault ?? 0}
        />
      </section>

      {/* 02 — Buyback & Holdings Trends */}
      <section className="space-y-5">
        <SectionRule index="02" title="Buyback & Holdings Trends" />
        <div className="grid grid-cols-1 divide-y divide-white/10 overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_20px_50px_rgba(9,5,20,0.18)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="min-w-0 p-5 sm:p-7">
            <ReservePythBoughtChart />
          </div>
          <div className="min-w-0 p-5 sm:p-7">
            <ReservePythHoldingChart />
          </div>
        </div>
      </section>

      {/* 03 — Reserve Accounts */}
      <section className="space-y-5">
        <SectionRule index="03" title="Reserve Accounts" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-5">
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
      </section>

      {/* 04 — Recent Swap Operations */}
      <section className="space-y-5">
        <SectionRule index="04" title="Recent Swap Operations" />
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
      </section>

      {/* 05 — About */}
      <section className="space-y-5 pb-2">
        <SectionRule index="05" title="About the Strategic Reserve" />
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm leading-relaxed text-[#b4aec8] sm:text-[15px] lg:grid-cols-[1fr_1px_1fr]">
          <p>
            The Pyth Strategic Reserve is a DAO-owned reserve established to
            systematically acquire PYTH tokens using protocol revenue,
            administered under strict on-chain guardrails.
          </p>
          <div className="hidden bg-white/10 lg:block" aria-hidden />
          <ul className="space-y-2">
            <li className="flex gap-3">
              <span
                className={`font-data shrink-0 text-cyan-300/60`}
              >
                &#8226;
              </span>
              Monthly purchases using one-third (33%) of the Treasury balance
            </li>
            <li className="flex gap-3">
              <span
                className={`font-data shrink-0 text-cyan-300/60`}
              >
                &#8226;
              </span>
              Administered by the Pythian Council Ops Multisig (6/8 approval
              required)
            </li>
            <li className="flex gap-3">
              <span
                className={`font-data shrink-0 text-cyan-300/60`}
              >
                &#8226;
              </span>
              All acquired PYTH tokens are repatriated to the DAO Treasury
            </li>
            <li className="flex gap-3">
              <span
                className={`font-data shrink-0 text-cyan-300/60`}
              >
                &#8226;
              </span>
              Transactions follow strict parameters: max 5% slippage, max
              $25,000 per transaction
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
