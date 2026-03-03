"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ExternalLink, ArrowRight, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { SwapTransaction } from "@/types/pythTypes";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SwapTransactionsProps {
  transactions: SwapTransaction[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  throttleRemainingMs: number;
  error: string | null;
  onPageChange: (page: number) => void;
}

export function SwapTransactions({
  transactions,
  page,
  pageSize,
  hasMore,
  isLoading,
  throttleRemainingMs,
  error,
  onPageChange,
}: SwapTransactionsProps) {
  const formatTokenAmount = (amount: number) => {
    if (amount === 0) return "0.00";
    if (amount < 0.01) return "< 0.01";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const formatBlock = (block: number) => {
    return new Intl.NumberFormat("en-US").format(block);
  };

  const formatDate = (date: string) => {
    return date && date.trim().length > 0 ? date : "—";
  };

  const getTokenIcon = (symbol: string): string => {
    const iconMap: Record<string, string> = {
      SOL: "/sol.webp",
      PYTH: "/pyth.svg",
      USDC: "/usdc.webp",
      USDT: "/usdt.svg",
    };
    return iconMap[symbol] || "";
  };

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = rangeStart + transactions.length - 1;
  const rangeLabel =
    transactions.length > 0 ? `${rangeStart}-${rangeEnd}` : `${rangeStart}-${rangeStart + pageSize - 1}`;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
  let endPage = startPage + maxVisiblePages - 1;
  if (page <= 3) {
    startPage = 1;
    endPage = maxVisiblePages;
  }
  if (page > 3) {
    startPage = page - 2;
    endPage = page + 2;
  }
  if (startPage < 1) startPage = 1;
  if (endPage < startPage) endPage = startPage;
  if (!hasMore && endPage > page) {
    endPage = page;
  }

  const pageNumbers = [];
  for (let p = startPage; p <= endPage; p += 1) {
    pageNumbers.push(p);
  }

  const throttleSeconds = Math.ceil(throttleRemainingMs / 1000);
  const throttleActive = throttleRemainingMs > 0;

  const hasTransactions = transactions.length > 0;

  return (
      <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)] transition-all duration-300">
      <CardHeader className="px-7 pt-7 pb-3 sm:px-8">
        <p className="text-[#a8a1bf] text-xs">
          Showing swaps {rangeLabel} to PYTH by Pythian Council Ops Multisig
        </p>
      </CardHeader>
          <CardContent className="px-7 pb-7 sm:px-8 sm:pb-8">
            {error ? (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
                <ExternalLink className="w-4 h-4" />
                {error}
              </div>
            ) : null}
            {isLoading && !hasTransactions ? (
              <div className="flex items-center justify-center py-10">
                <div className="flex items-center gap-2 text-[#a8a1bf] text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading swaps...
                </div>
              </div>
            ) : null}
            {!isLoading && !hasTransactions ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#312940] ring-1 ring-white/8 sm:h-24 sm:w-24">
                  <ExternalLink className="h-8 w-8 text-[#a8a1bf] sm:h-12 sm:w-12" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
                  No Swap Transactions Found
                </h3>
                <p className="max-w-md mx-auto text-sm text-[#b4aec8] sm:text-base">
                  No recent swap operations have been detected for the Pyth Council Ops wallet.
                </p>
              </div>
            ) : null}
            {hasTransactions ? (
              <>
                {/* Table Header - Desktop Only */}
                <div className="mb-3 hidden items-center justify-evenly gap-4 border-b border-white/8 px-3 pb-3 md:flex">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 flex-shrink-0"></div>
                    <div className="min-w-0">
                      <p className="text-[#8f88a9] text-xs font-medium">Input Token</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-4"></div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 flex-shrink-0"></div>
                    <div className="min-w-0">
                      <p className="text-[#8f88a9] text-xs font-medium">Output (PYTH)</p>
                    </div>
                  </div>
                  <div className="flex-1 text-center min-w-0">
                    <p className="text-[#8f88a9] text-xs font-medium">Signature</p>
                  </div>
                  <div className="flex-1 text-center min-w-0">
                    <p className="text-[#8f88a9] text-xs font-medium">Date/Time</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[#8f88a9] text-xs font-medium">Block</p>
                  </div>
                  <div className="flex-shrink-0 w-4"></div>
                </div>
                <div className="space-y-2">
                  {transactions.map((tx, index) => (
                    <a
                      key={tx.signature}
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-2xl border border-white/6 bg-[#2f2942] p-3 transition-all duration-200 ease-in-out hover:scale-[1.01] hover:border-white/12 hover:bg-[#352d47]"
                    >
                      {/* Mobile Layout */}
                      <div className="space-y-3 md:hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {getTokenIcon(tx.inputToken) ? (
                        <Image
                          src={getTokenIcon(tx.inputToken)}
                          alt={tx.inputToken}
                          width={24}
                          height={24}
                          className="w-6 h-6"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
                          <span className="text-purple-400 text-xs font-bold">
                            {tx.inputToken.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-semibold text-sm">
                        {formatTokenAmount(tx.inputAmount)}
                      </p>
                      <p className="truncate text-xs text-[#a8a1bf]">{tx.inputToken}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#8f88a9] flex-shrink-0" />
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      <Image
                        src="/pyth.svg"
                        alt="PYTH"
                        width={24}
                        height={24}
                        className="w-6 h-6"
                      />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {formatTokenAmount(tx.outputAmount)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/8 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 min-w-0">
                      <p className="mb-1 text-xs text-[#8f88a9]">Signature</p>
                      <p className="truncate font-mono text-xs text-[#d8d3ea]">
                        {formatAddress(tx.signature)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-xs text-[#8f88a9]">Date/Time</p>
                      <p className="text-white text-xs font-medium truncate">
                        {formatDate(tx.date)}
                      </p>
                    </div>
                    <div className="min-w-0 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="mb-1 text-xs text-[#8f88a9]">Block</p>
                        <p className="text-white text-sm font-semibold truncate">
                          {formatBlock(tx.block)}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-[#8f88a9] flex-shrink-0" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden md:flex items-center justify-evenly gap-4">
                {/* Input Token */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    {getTokenIcon(tx.inputToken) ? (
                      <Image
                        src={getTokenIcon(tx.inputToken)}
                        alt={tx.inputToken}
                        width={24}
                        height={24}
                        className="w-6 h-6"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <span className="text-purple-400 text-xs font-bold">
                          {tx.inputToken.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm">
                      {formatTokenAmount(tx.inputAmount)}
                    </p>
                      <p className="truncate text-xs text-[#a8a1bf]">{tx.inputToken}</p>
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-4 h-4 text-[#8f88a9] flex-shrink-0" />

                {/* Output Token (PYTH) */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <Image
                      src="/pyth.svg"
                      alt="PYTH"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm">
                      {formatTokenAmount(tx.outputAmount)}
                    </p>
                  </div>
                </div>

                {/* Signature */}
                <div className="flex-1 text-center min-w-0">
                  <p className="truncate font-mono text-xs text-[#d8d3ea]">{formatAddress(tx.signature)}</p>
                </div>

                {/* Date/Time */}
                <div className="flex-1 text-center min-w-0">
                  <p className="truncate text-xs text-[#d8d3ea]">
                    {formatDate(tx.date)}
                  </p>
                </div>

                {/* Block */}
                <div className="flex-1 text-center">
                  <p className="text-white text-sm font-semibold">{formatBlock(tx.block)}</p>
                </div>

                {/* External Link */}
                <div className="flex-shrink-0">
                  <ExternalLink className="w-4 h-4 text-[#8f88a9] transition-colors hover:text-white" />
                </div>
                </div>
            </a>
          ))}
        </div>
      </>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-[#a8a1bf]">{pageSize} per page</div>
          <div className="flex items-center gap-2">
            {throttleActive ? (
              <div className="text-xs text-purple-300 mr-1">
                You can click in {throttleSeconds}s
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl hover:bg-white/5 hover:text-white transition-colors hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#8f88a9]"
              onClick={() => onPageChange(1)}
              disabled={page === 1 || isLoading || throttleActive}
            >
              <span className="text-xs font-semibold">«</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl hover:bg-white/5 hover:text-white transition-colors hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#8f88a9]"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1 || isLoading || throttleActive}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pageNumbers.map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400",
                  p === page
                    ? "bg-purple-600 text-white hover:bg-purple-500"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white hover:cursor-pointer"
                )}
                onClick={() => onPageChange(p)}
                disabled={isLoading || throttleActive}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-gray-800 hover:text-white transition-colors hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
              onClick={() => onPageChange(page + 1)}
              disabled={!hasMore || isLoading || throttleActive}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
