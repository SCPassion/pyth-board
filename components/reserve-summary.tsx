"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PythReserveSummary } from "@/types/pythTypes";
import { TrendingUp } from "lucide-react";
import Image from "next/image";

interface ReserveSummaryProps {
  reserveSummary: PythReserveSummary;
  /** USDC balance in Jupiter DCA vault (Council Ops) — included in Total Reserve Value */
  dcaVaultUsdc?: number;
}

export function ReserveSummary({
  reserveSummary,
  dcaVaultUsdc = 0,
}: ReserveSummaryProps) {
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
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Pyth Reserve Summary
        </h2>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-xs text-[#b8b0d0]"
          >
            OP-PIP-87
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-5">
        <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2a2238] ring-1 ring-white/8 sm:h-12 sm:w-12">
                <TrendingUp className="h-5 w-5 text-[#c4a6ff] sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-xs text-[#a8a1bf] sm:text-sm">
                  Total Reserve Value
                </p>
                <p className="text-2xl font-bold text-white sm:text-3xl">
                  {formatCurrency(
                    reserveSummary.totalReserveValue + dcaVaultUsdc
                  )}
                </p>
                {dcaVaultUsdc > 0 && (
                  <p className="mt-1 text-xs text-[#8f88a9]">
                    includes DCA vault
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2a2238] ring-1 ring-white/8 sm:h-12 sm:w-12">
                <Image
                  src="/pyth.svg"
                  alt="PYTH"
                  width={32}
                  height={32}
                  className="w-6 h-6 sm:w-8 sm:h-8"
                />
              </div>
              <div>
                <p className="text-xs text-[#a8a1bf] sm:text-sm">
                  Total PYTH Held
                </p>
                <p className="text-2xl font-bold text-white sm:text-3xl">
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
