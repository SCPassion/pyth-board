"use client";

import { Card, CardContent } from "@/components/ui/card";
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
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold text-white">{children}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">
                  OIS Total Staked
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {oisTotalStaked}M PYTH
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">
                  OIS Rewards Distributed
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {rewardsDistributed}M PYTH
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">
                  Governance Total Staked
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {totalGovernance}B PYTH
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
