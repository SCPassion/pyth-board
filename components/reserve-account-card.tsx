"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReserveAccountInfo } from "@/types/pythTypes";
import { Wallet, ExternalLink, Repeat, CheckCircle2, XCircle } from "lucide-react";
import Image from "next/image";

export type JupiterDcaBlock = {
  usingDca: boolean;
  usdcBalanceVault: number;
  vaultUrl: string;
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

  return (
    <Card className="bg-[#2a2f3e] border-gray-700 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 group">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-white text-lg sm:text-xl truncate">{accountInfo.name}</CardTitle>
              <p className="text-gray-400 text-xs sm:text-sm font-mono mt-1 truncate">
                {formatAddress(accountInfo.address)}
              </p>
            </div>
          </div>
          <a
            href={solanaExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-purple-400 transition-colors flex-shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total USD Value */}
        {/* Calculate total from displayed values to ensure it matches the sum of individual items */}
        {(() => {
          // Use the actual SOL price from the API (passed from server)
          const solPrice = accountInfo.solPrice || 150; // Fallback if not available
          const solValue = accountInfo.solBalance * solPrice;
          
          // Sum all token USD values (these are the exact values displayed below)
          const tokenTotal = accountInfo.tokenBalances.reduce(
            (sum, token) => sum + (token.usdValue || 0),
            0
          );
          
          // Total = SOL value + sum of all displayed token values
          // This ensures the total matches: SOL + USDC + PYTH + USDT
          const calculatedTotal = solValue + tokenTotal;
          
          return (
            <div className="bg-gray-800/50 rounded-lg p-4 sm:p-6">
              <p className="text-gray-400 text-xs sm:text-sm mb-1">Total Value</p>
              <p className="text-2xl sm:text-3xl font-bold text-white break-words">
                {formatCurrency(calculatedTotal)}
              </p>
            </div>
          );
        })()}

        {/* SOL Balance */}
        {accountInfo.solBalance > 0 && (
          <div>
            <p className="text-gray-400 text-xs sm:text-sm font-medium mb-3">Solana Balance</p>
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-800/30 rounded-lg gap-2">
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
                <span className="text-gray-300 text-xs sm:text-sm">SOL</span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white font-semibold text-sm sm:text-base">
                  {formatTokenAmount(accountInfo.solBalance, 4)}
                </p>
                <p className="text-gray-400 text-xs">
                  {formatCurrency(accountInfo.solBalance * (accountInfo.solPrice || 150))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Token Balances */}
        {accountInfo.tokenBalances.length > 0 && (
          <div>
            <div className="mb-3">
              <p className="text-gray-400 text-xs sm:text-sm font-medium">Token Holdings</p>
              <p className="text-gray-500 text-xs mt-1">
                SOL balance is required for token operations on Solana
              </p>
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              {accountInfo.tokenBalances.map((token, index) => (
                <div
                  key={`${token.mint}-${index}`}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors flex-1 min-w-[140px] sm:min-w-0"
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
                        <span className="text-purple-400 text-xs font-bold">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-300 text-xs font-medium truncate">
                      {token.symbol}
                    </p>
                    <p className="text-white font-semibold text-sm">
                      {formatTokenAmount(token.amount, token.decimals)}
                    </p>
                    {token.usdValue !== undefined && token.usdValue > 0 && (
                      <p className="text-gray-400 text-xs">
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
            <p className="text-gray-400 text-xs sm:text-sm font-medium mb-2">
              Jupiter DCA
            </p>
            {dcaLoading ? (
              <div className="p-3 sm:p-4 bg-gray-800/30 rounded-lg flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-600 rounded-lg animate-pulse flex-shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="h-3 bg-gray-600 rounded animate-pulse w-28" />
                  <div className="h-4 bg-gray-600 rounded animate-pulse w-20" />
                </div>
              </div>
            ) : (
              <a
                href={jupiterDca?.vaultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 sm:p-4 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors border border-transparent hover:border-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Repeat className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {jupiterDca?.usingDca ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                            <span className="text-white font-medium text-sm">
                              Using Jupiter DCA
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <span className="text-white font-medium text-sm">
                              Not using DCA
                            </span>
                          </>
                        )}
                        <ExternalLink className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      </div>
                      {!jupiterDca?.usingDca && (
                        <p className="text-gray-500 text-xs mt-0.5">
                          No active USDC → PYTH orders
                        </p>
                      )}
                    </div>
                  </div>
                  {jupiterDca?.usingDca && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Image
                        src="/usdc.webp"
                        alt="USDC"
                        width={20}
                        height={20}
                        className="w-5 h-5"
                      />
                      <span className="text-white font-semibold text-sm tabular-nums">
                        {formatCurrency(jupiterDca.usdcBalanceVault)} USDC
                      </span>
                    </div>
                  )}
                </div>
              </a>
            )}
          </div>
        )}

        {accountInfo.tokenBalances.length === 0 &&
          accountInfo.solBalance === 0 &&
          jupiterDca === undefined && (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">No holdings found</p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

