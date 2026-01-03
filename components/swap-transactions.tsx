"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, ArrowRight } from "lucide-react";
import type { SwapTransaction } from "@/types/pythTypes";
import Image from "next/image";

interface SwapTransactionsProps {
  transactions: SwapTransaction[];
}

export function SwapTransactions({ transactions }: SwapTransactionsProps) {
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

  const getTokenIcon = (symbol: string): string => {
    const iconMap: Record<string, string> = {
      SOL: "/sol.webp",
      PYTH: "/pyth.svg",
      USDC: "/usdc.webp",
      USDT: "/usdt.svg",
    };
    return iconMap[symbol] || "";
  };

  if (transactions.length === 0) {
    return (
      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">
            Recent Swap Operations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm">No swap transactions found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#2a2f3e] border-gray-700">
      <CardHeader>
        <CardTitle className="text-white text-lg">
          Recent Swap Operations
        </CardTitle>
        <p className="text-gray-400 text-xs mt-1">
          Last 10 token swaps to PYTH by Pythian Council Ops Multisig
        </p>
          </CardHeader>
          <CardContent>
            {/* Table Header */}
            <div className="hidden sm:flex items-center justify-evenly gap-4 pb-3 mb-3 border-b border-gray-700 px-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 flex-shrink-0"></div>
                <div>
                  <p className="text-gray-400 text-xs font-medium">Input Token</p>
                </div>
              </div>
              <div className="flex-shrink-0 w-4"></div>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 flex-shrink-0"></div>
                <div>
                  <p className="text-gray-400 text-xs font-medium">Output (PYTH)</p>
                </div>
              </div>
              <div className="flex-1 text-center">
                <p className="text-gray-400 text-xs font-medium">Signature</p>
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
              <div className="flex items-center justify-evenly gap-4">
                {/* Input Token */}
                <div className="flex items-center gap-2 flex-1">
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
                  <div>
                    <p className="text-white font-semibold text-sm">
                      {formatTokenAmount(tx.inputAmount)}
                    </p>
                    <p className="text-gray-400 text-xs">{tx.inputToken}</p>
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />

                {/* Output Token (PYTH) */}
                <div className="flex items-center gap-2 flex-1">
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

                {/* Signature */}
                <div className="flex-1 text-center">
                  <p className="text-gray-300 text-xs font-mono">{formatAddress(tx.signature)}</p>
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
      </CardContent>
    </Card>
  );
}

