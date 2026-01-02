"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Users } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{children}</h2>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-gray-400 border-gray-600 text-xs"
          >
            {connectedWallets} Wallets
          </Badge>
          <Badge
            variant="outline"
            className="text-gray-400 border-gray-600 text-xs"
          >
            {totalStaked.toFixed(0)} PYTH
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="bg-[#2a2f3e] border-gray-700 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                  Connected Wallets
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-purple-100 transition-colors">
                  {connectedWallets}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700 hover:border-green-400 hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-2">
              <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">Total Staked</p>
              <p className="text-xl sm:text-2xl font-bold text-white group-hover:text-green-100 transition-colors">
                {totalStaked.toFixed(0)} PYTH
              </p>
              <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                Total Staked in USD
              </p>
              <p className="text-xl sm:text-2xl font-bold text-white group-hover:text-green-100 transition-colors">
                $ {amountInUSD ? amountInUSD.toFixed(0) : "..."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-400 group-hover:text-green-300 transition-colors" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                  Unique Number of Validators{" "}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-blue-100 transition-colors">
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
