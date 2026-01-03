"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReserveAccountInfo } from "@/types/pythTypes";
import { Wallet, ExternalLink } from "lucide-react";
import Image from "next/image";

interface ReserveAccountCardProps {
  accountInfo: ReserveAccountInfo;
}

export function ReserveAccountCard({ accountInfo }: ReserveAccountCardProps) {
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
    if (amount === 0) return "0";
    if (amount < 0.01) return "< 0.01";
    
    // Validate and clamp decimals to valid range (0-20) for Intl.NumberFormat
    // Handle edge cases: NaN, Infinity, negative numbers
    let safeDecimals = 0;
    if (typeof decimals === "number" && !isNaN(decimals) && isFinite(decimals)) {
      safeDecimals = Math.max(0, Math.min(20, Math.floor(decimals)));
    }
    
    // Use a reasonable default for token display (max 6 decimal places)
    const displayDecimals = Math.min(safeDecimals, 6);
    
    // Ensure minimumFractionDigits is valid (0-20) and <= maximumFractionDigits
    const minFractionDigits = Math.max(0, Math.min(2, displayDecimals));
    const maxFractionDigits = Math.max(minFractionDigits, Math.min(20, displayDecimals));
    
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
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
    <Card className="bg-[#2a2f3e] border-gray-700 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Wallet className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">{accountInfo.name}</CardTitle>
              <p className="text-gray-400 text-xs font-mono mt-1">
                {formatAddress(accountInfo.address)}
              </p>
            </div>
          </div>
          <a
            href={solanaExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-purple-400 transition-colors"
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
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Total Value</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(calculatedTotal)}
              </p>
            </div>
          );
        })()}

        {/* SOL Balance */}
        {accountInfo.solBalance > 0 && (
          <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                <Image
                  src="/sol.webp"
                  alt="SOL"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
              </div>
              <span className="text-gray-300 text-sm">SOL</span>
            </div>
            <div className="text-right">
              <p className="text-white font-semibold">
                {formatTokenAmount(accountInfo.solBalance, 4)}
              </p>
              <p className="text-gray-400 text-xs">
                {formatCurrency(accountInfo.solBalance * (accountInfo.solPrice || 150))}
              </p>
            </div>
          </div>
        )}

        {/* Token Balances */}
        {accountInfo.tokenBalances.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-400 text-sm font-medium">Token Holdings</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {accountInfo.tokenBalances.map((token, index) => (
                <div
                  key={`${token.mint}-${index}`}
                  className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {getTokenIcon(token.symbol) ? (
                        <Image
                          src={getTokenIcon(token.symbol)}
                          alt={token.symbol}
                          width={24}
                          height={24}
                          className="w-6 h-6"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
                          <span className="text-purple-400 text-xs font-bold">
                            {token.symbol.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-300 text-sm font-medium truncate">
                        {token.symbol}
                      </p>
                      {token.symbol === "UNKNOWN" && (
                        <p className="text-gray-500 text-xs font-mono truncate">
                          {formatAddress(token.mint)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-2">
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

        {accountInfo.tokenBalances.length === 0 && accountInfo.solBalance === 0 && (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">No holdings found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

