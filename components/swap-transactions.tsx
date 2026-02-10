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
  onPageChange: (page: number) => void;
}

export function SwapTransactions({
  transactions,
  page,
  pageSize,
  hasMore,
  isLoading,
  throttleRemainingMs,
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

  if (transactions.length === 0) {
    return (
      <Card className="bg-[#2a2f3e] border-gray-700 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300">
        <CardHeader>
          <p className="text-gray-400 text-xs">
            Token swaps to PYTH by Pythian Council Ops Multisig
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading swaps...
              </div>
            </div>
          ) : (
          <div className="text-center py-8 sm:py-12 px-4">
            <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
              <ExternalLink className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
              No Swap Transactions Found
            </h3>
            <p className="text-sm sm:text-base text-gray-400 max-w-md mx-auto">
              No recent swap operations have been detected for the Pyth Council Ops wallet.
            </p>
          </div>
          )}
        </CardContent>
      </Card>
    );
  }

    return (
      <Card className="bg-[#2a2f3e] border-gray-700 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300">
      <CardHeader>
        <p className="text-gray-400 text-xs">
          Showing swaps {rangeLabel} to PYTH by Pythian Council Ops Multisig
        </p>
      </CardHeader>
          <CardContent>
            {/* Table Header - Desktop Only */}
            <div className="hidden md:flex items-center justify-evenly gap-4 pb-3 mb-3 border-b border-gray-700 px-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-6 h-6 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs font-medium">Input Token</p>
                </div>
              </div>
              <div className="flex-shrink-0 w-4"></div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-6 h-6 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs font-medium">Output (PYTH)</p>
                </div>
              </div>
              <div className="flex-1 text-center min-w-0">
                <p className="text-gray-400 text-xs font-medium">Signature</p>
              </div>
              <div className="flex-1 text-center min-w-0">
                <p className="text-gray-400 text-xs font-medium">Date/Time</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-gray-400 text-xs font-medium">Block</p>
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
                  className="block p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-md hover:shadow-purple-500/20 border border-transparent hover:border-purple-500/30"
                >
              {/* Mobile Layout */}
              <div className="md:hidden space-y-3">
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
                      <p className="text-gray-400 text-xs truncate">{tx.inputToken}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
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
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-700">
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-400 text-xs mb-1">Signature</p>
                    <p className="text-gray-300 text-xs font-mono truncate">{formatAddress(tx.signature)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-gray-400 text-xs mb-1">Date/Time</p>
                    <p className="text-white text-xs font-medium">
                      {formatDate(tx.date)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-gray-400 text-xs mb-1">Block</p>
                    <p className="text-white text-sm font-semibold">
                      {formatBlock(tx.block)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <ExternalLink className="w-4 h-4 text-gray-500" />
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
                    <p className="text-gray-400 text-xs truncate">{tx.inputToken}</p>
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />

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
                  <p className="text-gray-300 text-xs font-mono truncate">{formatAddress(tx.signature)}</p>
                </div>

                {/* Date/Time */}
                <div className="flex-1 text-center min-w-0">
                  <p className="text-gray-300 text-xs truncate">
                    {formatDate(tx.date)}
                  </p>
                </div>

                {/* Block */}
                <div className="flex-1 text-center">
                  <p className="text-white text-sm font-semibold">{formatBlock(tx.block)}</p>
                </div>

                {/* External Link */}
                <div className="flex-shrink-0">
                  <ExternalLink className="w-4 h-4 text-gray-500 hover:text-purple-400 transition-colors" />
                </div>
              </div>
            </a>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400">{pageSize} per page</div>
          <div className="flex items-center gap-2">
            {throttleActive ? (
              <div className="text-xs text-purple-300 mr-1">
                You can click in {throttleSeconds}s
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-gray-800 hover:text-white transition-colors hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
              onClick={() => onPageChange(1)}
              disabled={page === 1 || isLoading || throttleActive}
            >
              <span className="text-xs font-semibold">«</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-gray-800 hover:text-white transition-colors hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
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
