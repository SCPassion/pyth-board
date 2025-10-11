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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{children}</h2>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-gray-400 border-gray-600 text-xs"
          >
            Network Stats
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="bg-[#2a2f3e] border-gray-700 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                  OIS Total Staked
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-purple-100 transition-colors">
                  {oisTotalStaked}M PYTH
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                  OIS Rewards Distributed
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-blue-100 transition-colors">
                  {rewardsDistributed}M PYTH
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2a2f3e] border-gray-700 hover:border-green-400 hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 group">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-400 group-hover:text-green-300 transition-colors" />
              </div>
              <div>
                <p className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                  Governance Total Staked
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white group-hover:text-green-100 transition-colors">
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
