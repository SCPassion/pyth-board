"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useWalletInfosStore } from "@/store/store";
import { BadgeDollarSign, Beef } from "lucide-react";
import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type MetricCardsProps = {
  pythPrice: number | null;
  totalStaked: number;
  totalRewards: number;
};
export function MetricCards({
  pythPrice,
  totalStaked,
  totalRewards,
}: MetricCardsProps) {
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs sm:text-sm">Pyth Price</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            ${pythPrice ? pythPrice.toFixed(4) : "..."} USD
          </p>

          <div className="flex justify-center items-center">
            <Beef className="w-16 h-16 sm:w-20 sm:h-20" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs sm:text-sm">
              Wallet Distribution
            </p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {wallets.length} Wallets
          </p>

          <div className="h-24 sm:h-32 flex items-center justify-center">
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
          <div className="space-y-1">
            {walletData.map((wallet, index) => (
              <div
                key={wallet.name}
                className="flex items-center justify-between text-xs sm:text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 sm:w-3 sm:h-3 rounded-full"
                    style={{
                      backgroundColor:
                        WALLET_COLORS[index % WALLET_COLORS.length],
                    }}
                  />
                  <span className="text-gray-300 truncate">{wallet.name}</span>
                </div>
                <span className="text-white font-medium">
                  {wallet.percentage}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs sm:text-sm">Total Rewards</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {totalRewards.toFixed(0)} PYTH
          </p>

          <div className="flex justify-center items-center">
            <BadgeDollarSign className="w-16 h-16 sm:w-20 sm:h-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
