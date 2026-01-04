"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PythReserveSummary } from "@/types/pythTypes";
import { TrendingUp, Coins, Building2 } from "lucide-react";
import Image from "next/image";

interface ReserveSummaryProps {
  reserveSummary: PythReserveSummary;
}

export function ReserveSummary({ reserveSummary }: ReserveSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatTokenAmount = (amount: number) => {
    if (amount === 0) return "0";
    if (amount < 0.01) return "< 0.01";
    if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(2)}M`;
    }
    if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(2)}K`;
    }
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Pyth Reserve Summary
        </h2>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-gray-400 border-gray-600 text-xs"
          >
            OP-PIP-87
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Total Reserve Value */}
        <Card className="bg-[#2a2f3e] border-gray-600 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                  Total Reserve Value
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-purple-100 transition-colors">
                  {formatCurrency(reserveSummary.totalReserveValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total PYTH Held */}
        <Card className="bg-[#2a2f3e] border-gray-600 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                <Image
                  src="/pyth.svg"
                  alt="PYTH"
                  width={32}
                  height={32}
                  className="w-6 h-6 sm:w-8 sm:h-8"
                />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                  Total PYTH Held
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-blue-100 transition-colors">
                  {formatTokenAmount(reserveSummary.totalPythHeld)} PYTH
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

