"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Users } from "lucide-react";

interface GeneralSummaryProps {
  totalGovernance: string;
  oisTotalStaked: string;
  rewardsDistributed: string;
  children?: React.ReactNode;
}

export function GeneralSummary({
  totalGovernance,
  oisTotalStaked,
  rewardsDistributed,
  children,
}: GeneralSummaryProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">{children}</h2>
          <p className="mt-1 text-sm text-[#a8a1bf]">
            Network figures styled to match the updated dashboard chrome.
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-xs text-[#b8b0d0]"
        >
          Network Stats
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-[28px] border-white/10 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2a2238] ring-1 ring-white/8">
              <Wallet className="h-5 w-5 text-[#c4a6ff]" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#9d95b9]">
              OIS Total Staked
            </p>
            <p className="mt-3 text-3xl font-bold text-white">
              {oisTotalStaked}M PYTH
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/10 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2a2238] ring-1 ring-white/8">
              <TrendingUp className="h-5 w-5 text-[#89f3ff]" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#9d95b9]">
              OIS Rewards Distributed
            </p>
            <p className="mt-3 text-3xl font-bold text-white">
              {rewardsDistributed}M PYTH
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/10 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2a2238] ring-1 ring-white/8">
              <Users className="h-5 w-5 text-[#8dfdd0]" />
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#9d95b9]">
              Governance Total Staked
            </p>
            <p className="mt-3 text-3xl font-bold text-white">
              {totalGovernance}B PYTH
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
