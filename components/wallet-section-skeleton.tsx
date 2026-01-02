"use client";

import { Card, CardContent } from "@/components/ui/card";

export function WalletSectionSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-4 sm:space-y-0">
            {/* Left side - Wallet info */}
            <div className="space-y-2">
              <div className="h-6 sm:h-8 bg-gray-600 rounded animate-pulse w-48"></div>
              <div className="h-4 bg-gray-600 rounded animate-pulse w-64"></div>
              <div className="h-4 bg-gray-600 rounded animate-pulse w-64"></div>
            </div>
            {/* Right side - Remove button, Total Staked, Claimable Rewards */}
            <div className="text-left sm:text-right space-y-3">
              <div className="h-8 bg-gray-600 rounded animate-pulse w-32 sm:w-28"></div>
              <div className="space-y-2">
                <div>
                  <div className="h-6 sm:h-8 bg-gray-600 rounded animate-pulse w-32"></div>
                  <div className="h-4 bg-gray-600 rounded animate-pulse w-24 mt-1"></div>
                </div>
                <div>
                  <div className="h-6 sm:h-8 bg-gray-600 rounded animate-pulse w-32"></div>
                  <div className="h-4 bg-gray-600 rounded animate-pulse w-28 mt-1"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Flex layout: Staking APY, Number of Delegated Validators, Claimable Rewards (pushed to right) */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div>
              <div className="h-4 bg-gray-600 rounded animate-pulse w-20 mb-2"></div>
              <div className="h-6 sm:h-8 bg-gray-600 rounded animate-pulse w-16"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-600 rounded animate-pulse w-36 mb-2"></div>
              <div className="h-6 sm:h-8 bg-gray-600 rounded animate-pulse w-8"></div>
            </div>
            <div className="sm:ml-auto">
              <div className="h-4 bg-gray-600 rounded animate-pulse w-28 mb-2"></div>
              <div className="h-6 sm:h-8 bg-gray-600 rounded animate-pulse w-24"></div>
            </div>
          </div>

          {/* Validators section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="h-6 sm:h-7 bg-gray-600 rounded animate-pulse w-40"></div>
              <div className="h-10 bg-gray-600 rounded animate-pulse w-full sm:w-64"></div>
            </div>

            <div className="space-y-2">
              {/* Header row - hidden on mobile */}
              <div className="hidden sm:grid grid-cols-3 gap-4 text-gray-400 text-sm font-medium pb-2 border-b border-gray-700">
                <div className="text-left">Validator's public key</div>
                <div className="text-center">Your Stake</div>
                <div className="text-center">APY</div>
              </div>

              {/* Skeleton validator rows */}
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center py-3 rounded-lg px-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-600 rounded-full animate-pulse"></div>
                    <div className="h-4 bg-gray-600 rounded animate-pulse w-32 sm:w-40"></div>
                  </div>
                  <div className="text-center">
                    <div className="sm:hidden h-3 bg-gray-600 rounded animate-pulse w-16 mb-1"></div>
                    <div className="h-5 bg-gray-600 rounded animate-pulse w-20 mx-auto"></div>
                  </div>
                  <div className="text-center">
                    <div className="sm:hidden h-3 bg-gray-600 rounded animate-pulse w-12 mb-1"></div>
                    <div className="h-5 bg-gray-600 rounded animate-pulse w-16 mx-auto"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

