"use client";

import { Card, CardContent } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <>
      {/* Portfolio Summary Skeleton */}
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Portfolio Summary
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Connected Wallets Card */}
          <Card className="bg-[#2a2f3e] border-gray-700">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-600 rounded-lg animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-600 rounded animate-pulse w-24"></div>
                  <div className="h-6 bg-gray-600 rounded animate-pulse w-8"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Staked Card */}
          <Card className="bg-[#2a2f3e] border-gray-700">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2">
                <div className="h-3 bg-gray-600 rounded animate-pulse w-20"></div>
                <div className="h-6 bg-gray-600 rounded animate-pulse w-24"></div>
                <div className="h-3 bg-gray-600 rounded animate-pulse w-28"></div>
                <div className="h-6 bg-gray-600 rounded animate-pulse w-20"></div>
              </div>
            </CardContent>
          </Card>

          {/* Unique Validators Card */}
          <Card className="bg-[#2a2f3e] border-gray-700">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-600 rounded-lg animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-600 rounded animate-pulse w-32"></div>
                  <div className="h-6 bg-gray-600 rounded animate-pulse w-8"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Metric Cards Skeleton - 2 cards only */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Pyth Price Card */}
        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-3 bg-gray-600 rounded animate-pulse w-16"></div>
            </div>
            <div className="h-8 bg-gray-600 rounded animate-pulse w-32"></div>
            <div className="flex justify-center items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-600 rounded animate-pulse"></div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Distribution Card */}
        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-3 bg-gray-600 rounded animate-pulse w-24"></div>
            </div>
            <div className="h-8 bg-gray-600 rounded animate-pulse w-20"></div>
            <div className="h-24 sm:h-32 bg-gray-600 rounded animate-pulse"></div>
            <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-1 justify-center">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-6 bg-gray-600 rounded animate-pulse w-16"
                ></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* General Information Skeleton */}
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          General Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {/* OIS Total Staked Card */}
          <Card className="bg-[#2a2f3e] border-gray-700">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-600 rounded-lg animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-600 rounded animate-pulse w-24"></div>
                  <div className="h-6 bg-gray-600 rounded animate-pulse w-20"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OIS Rewards Distributed Card */}
          <Card className="bg-[#2a2f3e] border-gray-700">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-600 rounded-lg animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-600 rounded animate-pulse w-28"></div>
                  <div className="h-6 bg-gray-600 rounded animate-pulse w-20"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Governance Total Staked Card */}
          <Card className="bg-[#2a2f3e] border-gray-700">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-600 rounded-lg animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-600 rounded animate-pulse w-32"></div>
                  <div className="h-6 bg-gray-600 rounded animate-pulse w-20"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
