"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, Users } from "lucide-react";

interface GeneralSummaryProps {
  totalGovernance: string;
  oisTotalStaked: string;
  rewardsDistributed: string;
}

export function GeneralSummary({
  totalGovernance,
  oisTotalStaked,
  rewardsDistributed,
}: GeneralSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="rounded-[28px] border-white/10 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="p-6 sm:p-7">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2a2238] ring-1 ring-white/8">
            <Wallet className="h-5 w-5 text-[#c4a6ff]" />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#9d95b9]">
            OIS Total Staked
          </p>
          <p className="font-data mt-3 text-3xl font-medium text-white">
            {oisTotalStaked}M PYTH
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-white/10 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="p-6 sm:p-7">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2a2238] ring-1 ring-white/8">
            <TrendingUp className="h-5 w-5 text-[#89f3ff]" />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#9d95b9]">
            OIS Rewards Distributed
          </p>
          <p className="font-data mt-3 text-3xl font-medium text-white">
            {rewardsDistributed}M PYTH
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-white/10 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="p-6 sm:p-7">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2a2238] ring-1 ring-white/8">
            <Users className="h-5 w-5 text-[#8dfdd0]" />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#9d95b9]">
            Governance Total Staked
          </p>
          <p className="font-data mt-3 text-3xl font-medium text-white">
            {totalGovernance}B PYTH
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
