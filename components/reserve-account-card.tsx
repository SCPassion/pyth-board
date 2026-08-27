"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TOKEN_SYMBOLS } from "@/data/pythReserveAddresses";
import type { JupiterDcaOrder, ReserveAccountInfo } from "@/types/pythTypes";
import {
  Wallet,
  ExternalLink,
  Repeat,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Image from "next/image";

export type JupiterDcaBlock = {
  usingDca: boolean;
  orders: JupiterDcaOrder[];
};

interface ReserveAccountCardProps {
  accountInfo: ReserveAccountInfo;
  /** When set, shows Jupiter DCA (owned by this account) inside the card */
  jupiterDca?: JupiterDcaBlock | null;
  dcaLoading?: boolean;
}

export function ReserveAccountCard({
  accountInfo,
  jupiterDca,
  dcaLoading = false,
}: ReserveAccountCardProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatTokenAmount = (amount: number, decimals: number = 0) => {
    if (amount === 0) return "0.00";
    if (amount < 0.01) return "< 0.01";

    // Format all amounts to 2 decimal places
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const solanaExplorerUrl = `https://solscan.io/account/${accountInfo.address}`;

  // Get icon path for token symbol
  const getTokenIcon = (symbol: string): string => {
    const iconMap: Record<string, string> = {
      SOL: "/sol.webp",
      PYTH: "/pyth.svg",
      USDC: "/usdc.webp",
      USDT: "/usdt.svg",
    };
    return iconMap[symbol] || "";
  };

  const getDcaOrderSymbol = (order: JupiterDcaOrder) =>
    TOKEN_SYMBOLS[order.inputMint] || `${order.inputMint.slice(0, 4)}...`;

  const getDcaOrderRemaining = (order: JupiterDcaOrder) =>
    Math.max(0, order.inDeposited - order.inUsed - order.inWithdrawn);

  const getDcaOrderUsdValue = (order: JupiterDcaOrder, solPrice: number) => {
    const symbol = getDcaOrderSymbol(order);
    const remaining = getDcaOrderRemaining(order);

    if (symbol === "SOL") return remaining * solPrice;
    if (symbol === "USDC" || symbol === "USDT") return remaining;
    return 0;
  };

  const getDcaOrderHref = (order: JupiterDcaOrder) =>
    `https://solscan.io/account/${order.orderKey}`;

  return (
    <Card className="group rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)] transition-all duration-300 hover:border-white/15">
      <CardHeader className="px-7 pt-7 pb-3 sm:px-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#2a2238] ring-1 ring-white/8 sm:h-12 sm:w-12">
              <Wallet className="h-5 w-5 text-[#c4a6ff] sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="font-display text-white text-lg sm:text-xl truncate">
                {accountInfo.name}
              </CardTitle>
              <p className="mt-1 truncate font-data text-xs text-[#a8a1bf] sm:text-sm">
                {formatAddress(accountInfo.address)}
              </p>
            </div>
          </div>
          <a
            href={solanaExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-[#8f88a9] transition-colors hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-7 pb-7 sm:px-8 sm:pb-8">
        {/* Total USD Value */}
        {/* Wallet tokens + SOL; add Jupiter DCA vault balances when present (vaults are separate, no double count) */}
        {(() => {
          const solPrice = accountInfo.solPrice || 150;
          const solValue = accountInfo.solBalance * solPrice;
          const tokenTotal = accountInfo.tokenBalances.reduce(
            (sum, token) => sum + (token.usdValue || 0),
            0,
          );
          // DCA vault balances are held in Jupiter vaults, not in this wallet's token accounts.
          const dcaVaultUsd =
            jupiterDca && jupiterDca.usingDca
              ? jupiterDca.orders.reduce(
                  (sum, order) => sum + getDcaOrderUsdValue(order, solPrice),
                  0
                )
              : 0;
          const calculatedTotal = solValue + tokenTotal + dcaVaultUsd;

          return (
            <div className="rounded-2xl bg-[#2f2942] p-4 sm:p-6 ring-1 ring-white/6">
              <p className="mb-1 text-xs text-[#a8a1bf] sm:text-sm">
                Total Value
              </p>
              <p className="font-data text-2xl sm:text-3xl font-medium text-white break-words">
                {formatCurrency(calculatedTotal)}
              </p>
              {dcaVaultUsd > 0 && (
                <p className="mt-1 text-xs text-[#8f88a9]">includes DCA vault</p>
              )}
            </div>
          );
        })()}

        {/* SOL Balance */}
        {accountInfo.solBalance > 0 && (
          <div>
            <p className="mb-3 text-xs font-medium text-[#a8a1bf] sm:text-sm">
              Solana Balance
            </p>
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#2f2942] p-3 sm:p-4 ring-1 ring-white/6">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <Image
                    src="/sol.webp"
                    alt="SOL"
                    width={24}
                    height={24}
                    className="w-6 h-6"
                  />
                </div>
                <span className="text-xs text-[#d8d3ea] sm:text-sm">SOL</span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white font-semibold text-sm sm:text-base">
                  {formatTokenAmount(accountInfo.solBalance, 4)}
                </p>
                <p className="text-xs text-[#a8a1bf]">
                  {formatCurrency(
                    accountInfo.solBalance * (accountInfo.solPrice || 150),
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Token Balances */}
        {accountInfo.tokenBalances.length > 0 && (
          <div>
            <div className="mb-3">
              <p className="text-xs font-medium text-[#a8a1bf] sm:text-sm">
                Token Holdings
              </p>
              <p className="mt-1 text-xs text-[#8f88a9]">
                SOL balance is required for token operations on Solana
              </p>
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              {accountInfo.tokenBalances.map((token, index) => (
                <div
                  key={`${token.mint}-${index}`}
                  className="flex min-w-[140px] flex-1 items-center gap-2 rounded-2xl bg-[#2f2942] px-3 py-2 ring-1 ring-white/6 transition-colors hover:bg-[#352d47] sm:min-w-0"
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {getTokenIcon(token.symbol) ? (
                      <Image
                        src={getTokenIcon(token.symbol)}
                        alt={token.symbol}
                        width={20}
                        height={20}
                        className="w-5 h-5"
                      />
                    ) : (
                      <div className="w-5 h-5 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-[#c4a6ff]">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[#d8d3ea]">
                      {token.symbol}
                    </p>
                    <p className="text-white font-semibold text-sm">
                      {formatTokenAmount(token.amount, token.decimals)}
                    </p>
                    {token.usdValue !== undefined && token.usdValue > 0 && (
                      <p className="text-xs text-[#a8a1bf]">
                        {formatCurrency(token.usdValue)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Jupiter DCA (when this account owns it) */}
        {jupiterDca !== undefined && (
          <div>
            <p className="mb-2 text-xs font-medium text-[#a8a1bf] sm:text-sm">
              Jupiter DCA
            </p>
            {dcaLoading ? (
              <div className="flex items-center gap-3 rounded-2xl bg-[#2f2942] p-3 sm:p-4 ring-1 ring-white/6">
                <div className="w-9 h-9 bg-gray-600 rounded-lg animate-pulse flex-shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-3 bg-gray-600 rounded animate-pulse w-28" />
                  <div className="h-4 bg-gray-600 rounded animate-pulse w-20" />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/6 bg-[#2f2942] p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
                    <Repeat className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {jupiterDca?.usingDca ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                          <span className="text-white font-medium text-sm">
                            Active DCA vaults
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-white font-medium text-sm">
                            No ongoing DCA
                          </span>
                        </>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#8f88a9]">
                      {jupiterDca?.usingDca
                        ? "Each vault links to its Jupiter order account"
                        : "No active DCA orders into PYTH"}
                    </p>
                  </div>
                </div>
                {jupiterDca?.usingDca && (
                  <div className="mt-3 grid gap-2">
                    {jupiterDca.orders.map((order) => {
                      const symbol = getDcaOrderSymbol(order);
                      const remaining = getDcaOrderRemaining(order);
                      const usdValue = getDcaOrderUsdValue(
                        order,
                        accountInfo.solPrice || 150
                      );
                      return (
                        <a
                          key={order.orderKey}
                          href={getDcaOrderHref(order)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2 transition-colors hover:border-emerald-500/25 hover:bg-white/[0.06]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {getTokenIcon(symbol) ? (
                              <Image
                                src={getTokenIcon(symbol)}
                                alt={symbol}
                                width={20}
                                height={20}
                                className="w-5 h-5"
                              />
                            ) : (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-[9px] font-bold text-[#c4a6ff]">
                                {symbol.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white">
                                {symbol} → PYTH
                              </p>
                              <p className="font-data truncate text-[10px] text-[#8f88a9]">
                                {order.orderKey.slice(0, 8)}...
                                {order.orderKey.slice(-6)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2 text-right">
                            <div>
                              <p className="text-white font-semibold text-sm tabular-nums">
                                {symbol === "USDC" || symbol === "USDT"
                                  ? formatCurrency(remaining)
                                  : formatTokenAmount(remaining, 4)}{" "}
                                {symbol}
                              </p>
                              {usdValue > 0 && symbol !== "USDC" && symbol !== "USDT" ? (
                                <p className="text-xs text-[#a8a1bf]">
                                  {formatCurrency(usdValue)}
                                </p>
                              ) : null}
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-[#8f88a9]" />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {accountInfo.tokenBalances.length === 0 &&
          accountInfo.solBalance === 0 &&
          jupiterDca === undefined && (
            <div className="text-center py-4">
              <p className="text-sm text-[#8f88a9]">No holdings found</p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
