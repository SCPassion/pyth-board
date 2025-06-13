"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useWalletInfosStore } from "@/store/store";
import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type MetricCardsProps = {
  totalStaked: number;
  totalRewards: number;
};
export function MetricCards({ totalStaked, totalRewards }: MetricCardsProps) {
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
    <div className="grid grid-cols-3 gap-6">
      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">Total Staked</p>
          </div>
          <p className="text-3xl font-bold text-white">
            {totalStaked.toLocaleString()} PYTH
          </p>

          <div className="flex gap-1 h-12 items-end">
            {heights.staked.map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-purple-600 to-purple-400 rounded-full transition-all duration-300 ease-out"
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">Wallet Distribution</p>
          </div>
          <p className="text-3xl font-bold text-white">
            {wallets.length} Wallets
          </p>

          <div className="h-32 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={walletData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={60}
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
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        WALLET_COLORS[index % WALLET_COLORS.length],
                    }}
                  />
                  <span className="text-gray-300">{wallet.name}</span>
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
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">Total Rewards</p>
          </div>
          <p className="text-3xl font-bold text-white">
            {totalRewards.toFixed(0)} PYTH
          </p>

          <div className="flex gap-1 h-12 items-end">
            {heights.rewards.map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-green-600 to-green-400 rounded-full transition-all duration-300 ease-out"
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
