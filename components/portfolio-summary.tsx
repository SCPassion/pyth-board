"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, Users } from "lucide-react";

interface PortfolioSummaryProps {
  connectedWallets: number;
  totalStaked: number;
  uniqueValidatorSize: number;
  children?: React.ReactNode;
  pythPrice: number | null;
}

export function PortfolioSummary({
  connectedWallets,
  totalStaked,
  uniqueValidatorSize,
  children,
  pythPrice,
}: PortfolioSummaryProps) {
  const amountInUSD = pythPrice ? totalStaked * pythPrice : 0;
  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold text-white">{children}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">
                  Connected Wallets
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {connectedWallets}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-2">
              <p className="text-gray-400 text-xs sm:text-sm">Total Staked</p>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {totalStaked.toFixed(0)} PYTH
              </p>
              <p className="text-gray-400 text-xs sm:text-sm">
                Total Staked in USD
              </p>
              <p className="text-xl sm:text-2xl font-bold text-white">
                $ {amountInUSD ? amountInUSD.toFixed(0) : "..."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">
                  Unique Number of Validators{" "}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {uniqueValidatorSize}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
