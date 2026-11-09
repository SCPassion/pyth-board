"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ReserveSummary } from "@/components/reserve-summary";
import { ReserveAccountCard } from "@/components/reserve-account-card";
import { SwapTransactions } from "@/components/swap-transactions";
import { ReservePythHoldingChart } from "@/components/reserve-pyth-holding-chart";
import { ReservePythBoughtChart } from "@/components/reserve-pyth-bought-chart";
import { TOKEN_SYMBOLS } from "@/data/pythReserveAddresses";
import type {
  PythReserveSummary,
  SwapTransaction,
  JupiterDcaCouncilOpsStatus,
} from "@/types/pythTypes";
import type { SwapTransactionsPage } from "@/action/swapTransactionsActions";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { SectionRule } from "@/components/section-rule";

function getDcaVaultUsd(
  dcaStatus: JupiterDcaCouncilOpsStatus | null,
  solPrice: number
) {
  return (dcaStatus?.orders ?? []).reduce((sum, order) => {
    const symbol = TOKEN_SYMBOLS[order.inputMint];
    const remaining = Math.max(
      0,
      order.inDeposited - order.inUsed - order.inWithdrawn
    );

    if (symbol === "SOL") return sum + remaining * solPrice;
    if (symbol === "USDC" || symbol === "USDT") return sum + remaining;
    return sum;
  }, 0);
}

// Plain GET requests rather than server actions: Next.js runs server actions
// from the client one at a time, so the summary, DCA and swap fetches used to
// queue behind each other (and behind the header's own actions). These
// requests run in parallel and are cached at the CDN.
async function fetchJson<T>(url: string, fresh: boolean): Promise<T> {
  const target = fresh
    ? `${url}${url.includes("?") ? "&" : "?"}fresh=${Date.now()}`
    : url;
  const res = await fetch(target, { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (body && typeof body.error === "string" && body.error) ||
        `Request failed (${res.status})`
    );
  }
  return body as T;
}

function SectionSkeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-[28px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] ${className}`}
    />
  );
}

function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="rounded-[28px] border-red-500/25 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-red-400">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <h3 className="mb-1 font-semibold text-white">
              Couldn&apos;t load reserve balances
            </h3>
            <p className="break-words text-sm text-[#b4aec8]">{message}</p>
          </div>
        </div>
        <button
          onClick={onRetry}
          className="font-data shrink-0 rounded-full border border-white/15 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/80 transition-colors hover:border-white/35 hover:text-white"
        >
          Retry
        </button>
      </CardContent>
    </Card>
  );
}

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
        const response = await fetchJson<SwapTransactionsPage>(
          `/api/reserve/swaps?page=${page}&pageSize=${swapPageSize}`,
          force
        );
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

  const fetchReserveData = useCallback(async (fresh: boolean = false) => {
    // Prevent multiple simultaneous fetches
    if (isFetchingReserveRef.current) {
      return;
    }
    isFetchingReserveRef.current = true;
    hasFetchedRef.current = true;
    setLoading(true);
    setReserveError(null);
    setDcaLoading(true);

    // Summary and DCA load independently so neither waits on the other.
    const summaryTask = fetchJson<PythReserveSummary>(
      "/api/reserve/summary",
      fresh
    )
      .then((data) => setReserveSummary(data))
      .catch((err) => {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch reserve data";
        setReserveError(errorMessage);
        console.error("Error fetching reserve summary:", err);
      })
      .finally(() => setLoading(false));

    const dcaTask = fetchJson<JupiterDcaCouncilOpsStatus>(
      "/api/reserve/dca",
      fresh
    )
      .then((dca) => setDcaStatus(dca))
      .catch((err) => console.error("Error fetching Jupiter DCA status:", err))
      .finally(() => setDcaLoading(false));

    await Promise.all([summaryTask, dcaTask]);
    isFetchingReserveRef.current = false;
  }, []);

  useEffect(() => {
    // Only fetch on initial mount if we haven't fetched yet
    if (!hasFetchedRef.current) {
      fetchReserveData();
      fetchSwapPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run once on mount

  const showSummaryError = reserveError && !reserveSummary;

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
              Strategic Reserve V2 &middot; OP&#8209;PIP&#8209;136
            </p>
            <h1
              className={`font-display text-3xl italic text-white sm:text-4xl lg:text-5xl`}
            >
              Pyth Strategic Reserve
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              Track PYTH accumulation under the DAO&apos;s{" "}
              <a
                href="https://forum.pyth.network/t/passed-op-pip-136-pyth-strategic-reserve-v2/2711"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                Strategic Reserve V2 framework
              </a>
              , alongside current SOL, PYTH, USDC &amp; USDT holdings.
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
                fetchReserveData(true);
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
        {reserveSummary ? (
          <ReserveSummary
            reserveSummary={reserveSummary}
            dcaVaultUsd={getDcaVaultUsd(
              dcaStatus,
              reserveSummary.pythianCouncilOps.solPrice
            )}
          />
        ) : showSummaryError ? (
          <SectionError
            message={reserveError ?? ""}
            onRetry={() => fetchReserveData(true)}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionSkeleton className="h-28" />
            <SectionSkeleton className="h-28" />
          </div>
        )}
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
        {reserveSummary ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-5">
            <ReserveAccountCard accountInfo={reserveSummary.daoTreasury} />
            <ReserveAccountCard
              accountInfo={reserveSummary.pythianCouncilOps}
              jupiterDca={{
                usingDca: dcaStatus?.usingDca ?? false,
                orders: dcaStatus?.orders ?? [],
              }}
              dcaLoading={dcaLoading}
            />
          </div>
        ) : showSummaryError ? (
          <p className="text-sm text-[#b4aec8]">
            Account balances are unavailable until the reserve data loads.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-5">
            <SectionSkeleton className="h-80" />
            <SectionSkeleton className="h-80" />
          </div>
        )}
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
        <SectionRule index="05" title="About Strategic Reserve V2" />
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm leading-relaxed text-[#b4aec8] sm:text-[15px] lg:grid-cols-[1fr_1px_1fr]">
          <div className="space-y-4">
            <p>
              OP-PIP-136 replaces monthly one-third Treasury purchases with
              ongoing PYTH accumulation from eligible non-PYTH assets and the
              DAO&apos;s approved revenue shares. Existing revenue shares and
              commercial terms remain unchanged.
            </p>
            <p>
              <a
                href="https://forum.pyth.network/t/passed-op-pip-140-recover-stranded-dao-usdc-transfer-the-treasury-to-the-pythian-council-ops-multisig-and-clarify-direct-fee-repatriation/2722"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                OP-PIP-140
              </a>{" "}
              further clarifies that eligible DAO-owned fees may be repatriated
              directly to Council-controlled multisigs for conversion under V2.
            </p>
          </div>
          <div className="hidden bg-white/10 lg:block" aria-hidden />
          <ul className="space-y-2">
            <li className="flex gap-3">
              <span
                className={`font-data shrink-0 text-cyan-300/60`}
              >
                &#8226;
              </span>
              Eligible assets can be converted without separate monthly purchase votes
            </li>
            <li className="flex gap-3">
              <span
                className={`font-data shrink-0 text-cyan-300/60`}
              >
                &#8226;
              </span>
              Council Ops executes conversions and returns purchased PYTH to the DAO Treasury
            </li>
            <li className="flex gap-3">
              <span
                className={`font-data shrink-0 text-cyan-300/60`}
              >
                &#8226;
              </span>
              Direct PYTH distributions are held by the DAO; they are not market purchases
            </li>
            <li className="flex gap-3">
              <span
                className={`font-data shrink-0 text-cyan-300/60`}
              >
                &#8226;
              </span>
              Execution limits: 5% slippage, $25,000 per transaction; limit orders at least 0.1% below market
            </li>
            <li className="flex gap-3">
              <span className="font-data shrink-0 text-cyan-300/60">&#8226;</span>
              No selling, borrowing against, leveraging or distributing accumulated PYTH without separate DAO approval
            </li>
            <li className="flex gap-3">
              <span className="font-data shrink-0 text-cyan-300/60">&#8226;</span>
              Monthly Council reports include execution details, balances and public transaction proofs
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
