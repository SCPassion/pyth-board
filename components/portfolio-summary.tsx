"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import Link from "next/link";

interface PortfolioSummaryProps {
  connectedWallets: number;
  totalStaked: number | null;
  pythPrice: number | null;
}

export function PortfolioSummary({
  connectedWallets,
  totalStaked,
  pythPrice,
}: PortfolioSummaryProps) {
  const amountInUSD = pythPrice !== null && totalStaked !== null ? totalStaked * pythPrice : null;
  const exposureValueLabel = connectedWallets === 0 ? "$0"
    : amountInUSD === null ? "Unavailable" : `$${amountInUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <Card className="group relative overflow-hidden rounded-[28px] border-white/10 bg-[linear-gradient(135deg,rgba(182,88,165,0.95)_0%,rgba(65,30,220,0.9)_100%)] py-0 shadow-[0_28px_80px_rgba(13,5,30,0.35)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/12 blur-2xl" />
      <div className="pointer-events-none absolute bottom-[-36px] right-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />
      <div className="pointer-events-none absolute right-20 top-14 h-16 w-16 rounded-2xl rotate-12 bg-white/10" />
      <CardContent className="relative p-7 sm:p-9">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="font-data text-[11px] font-semibold uppercase tracking-[0.24em] text-white/65">
                Total Governance Stake
              </p>
              <p className="font-data text-[clamp(1.375rem,4vw,3rem)] font-medium leading-none tracking-tight text-white">
                {totalStaked === null ? "Unavailable" : totalStaked.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
              <p className="text-lg font-semibold text-white/90 sm:text-xl">
                PYTH
              </p>
              <p className="max-w-[34ch] text-sm leading-7 text-white/78">
                Your governance stake across tracked wallets, including active,
                warming up, and unstaking positions.
              </p>
            </div>
            <Link
              href="/wallets"
              className="inline-flex rounded-2xl bg-[#23144d] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-[#2a1958]"
            >
              {connectedWallets} Wallet{connectedWallets === 1 ? "" : "s"} tracked
            </Link>
          </div>

          <div className="flex flex-col justify-center">
            <div className="rounded-3xl bg-black/18 p-5 ring-1 ring-white/10 backdrop-blur-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">
                Governance Stake Value
              </p>
              <p className="font-data mt-3 text-2xl font-medium text-white">
                {exposureValueLabel}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-white/65">
                Live value based on the current PYTH price
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
