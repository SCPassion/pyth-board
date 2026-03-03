"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import Link from "next/link";

interface PortfolioSummaryProps {
  connectedWallets: number;
  totalStaked: number;
  totalClaimableRewards: number;
  children?: React.ReactNode;
  pythPrice: number | null;
}

export function PortfolioSummary({
  connectedWallets,
  totalStaked,
  totalClaimableRewards,
  children,
  pythPrice,
}: PortfolioSummaryProps) {
  const amountInUSD = pythPrice ? totalStaked * pythPrice : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">{children}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-xs text-[#b8b0d0]"
          >
            {connectedWallets} Wallets
          </Badge>
          <Badge
            variant="outline"
            className="rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-xs text-[#b8b0d0]"
          >
            {totalStaked.toFixed(0)} PYTH
          </Badge>
        </div>
      </div>

      <div>
        <Card className="group relative overflow-hidden rounded-[28px] border-white/10 bg-[linear-gradient(135deg,rgba(182,88,165,0.95)_0%,rgba(65,30,220,0.9)_100%)] py-0 shadow-[0_28px_80px_rgba(13,5,30,0.35)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/12 blur-2xl" />
          <div className="pointer-events-none absolute bottom-[-36px] right-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="pointer-events-none absolute right-20 top-14 h-16 w-16 rounded-2xl rotate-12 bg-white/10" />
          <CardContent className="relative p-6 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/65">
                    Total PYTH Staked
                  </p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white sm:text-6xl">
                    {totalStaked.toFixed(0)}
                  </p>
                  <p className="text-lg font-semibold text-white/90 sm:text-xl">
                    PYTH
                  </p>
                  <p className="max-w-[34ch] text-sm leading-6 text-white/78">
                    Your live staking balance across all connected wallets, with
                    current market value and claimable rewards summarized here.
                  </p>
                </div>
                <Link
                  href="/wallets"
                  className="inline-flex rounded-2xl bg-[#23144d] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-[#2a1958]"
                >
                  {connectedWallets} Wallet{connectedWallets === 1 ? "" : "s"} connected
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-3xl bg-black/18 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/65">
                    Exposure Value
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    ${amountInUSD ? amountInUSD.toFixed(0) : "..."}
                  </p>
                  <p className="mt-2 text-xs text-white/65">
                    Live value based on the current PYTH price
                  </p>
                </div>

                <div className="rounded-3xl bg-black/18 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/65">
                    Claimable Rewards
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {totalClaimableRewards.toFixed(2)}
                  </p>
                  <p className="mt-2 text-xs text-white/65">
                    PYTH available to claim
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
