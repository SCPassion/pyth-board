"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWalletInfosStore } from "@/store/store";
import { Beef, TrendingUp, PieChart as PieChartIcon, Gift } from "lucide-react";
import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type MetricCardsProps = {
  pythPrice: number | null;
  totalStaked: number;
  totalClaimableRewards: number;
};
export function MetricCards({ pythPrice, totalStaked, totalClaimableRewards }: MetricCardsProps) {
  const rewardsInUSD = pythPrice ? totalClaimableRewards * pythPrice : 0;
  const wallets = useWalletInfosStore((state) => state.wallets);
  // Process wallet data for pie chart
  const walletData = wallets.map((wallet) => ({
    name: wallet.name,
    value: wallet.stakingInfo?.totalStakedPyth as number,
    percentage: (
      ((wallet.stakingInfo?.totalStakedPyth as number) / totalStaked) *
      100
    ).toFixed(1),
  }));

  const WALLET_COLORS = walletData.map((_, index) => {
    // Generate a color based on the index
    const hue = (index * 137.508) % 360; // Golden angle approximation
    return `hsl(${hue}, 30%, 30%)`; // HSL color format
  });

  // Generate deterministic default heights for SSR
  const defaultHeights = {
    staked: Array.from({ length: 24 }, () => 50),
    unstaking: Array.from({ length: 24 }, () => 40),
    rewards: Array.from({ length: 24 }, () => 35),
  };
  const [heights, setHeights] = useState(defaultHeights);

  useEffect(() => {
    setHeights({
      staked: Array.from({ length: 24 }, () => 20 + Math.random() * 60),
      unstaking: Array.from({ length: 24 }, () => 15 + Math.random() * 50),
      rewards: Array.from({ length: 24 }, () => 25 + Math.random() * 55),
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Market Metrics</h2>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-gray-400 border-gray-600 text-xs"
          >
            Live Data
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="bg-[#2a2f3e] border-gray-700 hover:border-green-400 hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400 group-hover:text-green-300 transition-colors" />
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">Pyth Price</p>
              </div>
              <Badge
                variant="outline"
                className="text-green-400 border-green-600 text-xs group-hover:bg-green-500/20 transition-colors"
              >
                Live
              </Badge>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-green-100 transition-colors">
              ${pythPrice ? pythPrice.toFixed(4) : "..."} USD
            </p>

            <div className="flex justify-center items-center">
              <Beef className="w-16 h-16 sm:w-20 sm:h-20 group-hover:scale-110 transition-transform duration-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                  Wallet Distribution
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-blue-400 border-blue-600 text-xs group-hover:bg-blue-500/20 transition-colors"
              >
                {wallets.length} Total
              </Badge>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-blue-100 transition-colors">
              {wallets.length} Wallets
            </p>

            <div className="h-24 sm:h-32 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={walletData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {walletData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={WALLET_COLORS[index % WALLET_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-1 justify-center">
              {walletData.map((wallet, index) => (
                <div
                  key={wallet.name}
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-gray-800/50 px-2 py-1 rounded-md group-hover:bg-gray-700/50 transition-colors"
                >
                  <div
                    className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        WALLET_COLORS[index % WALLET_COLORS.length],
                    }}
                  />
                  <span className="text-gray-300 truncate group-hover:text-white transition-colors">{wallet.name}</span>
                  <span className="text-white font-medium group-hover:text-blue-100 transition-colors">
                    {wallet.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-yellow-400 group-hover:text-yellow-300 transition-colors" />
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                  Total Claimable Rewards
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-yellow-400 border-yellow-600 text-xs group-hover:bg-yellow-500/20 transition-colors"
              >
                All Wallets
              </Badge>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-yellow-400 transition-colors">
              {totalClaimableRewards.toFixed(2)} PYTH
            </p>
            <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
              Rewards in USD
            </p>
            <p className="text-xl sm:text-2xl font-bold text-white group-hover:text-yellow-100 transition-colors">
              $ {rewardsInUSD ? rewardsInUSD.toFixed(2) : "..."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
