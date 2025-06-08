"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import React, { useEffect, useState } from "react";

interface MetricCardsProps {
  totalStaked: number;
  totalUnstaking: number;
  totalRewards: number;
}

export function MetricCards({
  totalStaked,
  totalUnstaking,
  totalRewards,
}: MetricCardsProps) {
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
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {totalStaked.toLocaleString()} PYTH
          </p>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-green-400">12.5%</span>
            <span className="text-gray-400">vs. last month</span>
          </div>
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
            <p className="text-gray-400 text-sm">Total Unstaking</p>
            <TrendingDown className="h-4 w-4 text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-white">{totalUnstaking} PYTH</p>
          <div className="flex items-center gap-2 text-sm">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <span className="text-red-400">8.3%</span>
            <span className="text-gray-400">vs. last month</span>
          </div>
          <div className="flex gap-1 h-12 items-end">
            {heights.unstaking.map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-orange-600 to-orange-400 rounded-full transition-all duration-300 ease-out"
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
            <p className="text-gray-400 text-sm">Total Rewards</p>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {totalRewards.toFixed(0)} PYTH
          </p>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-green-400">15.8%</span>
            <span className="text-gray-400">vs. last month</span>
          </div>
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
