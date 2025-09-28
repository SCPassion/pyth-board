"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <>
      {/* Portfolio Summary Skeleton */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Portfolio Summary</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-[#2a2f3e] border-gray-700">
              <CardHeader className="pb-3">
                <div className="h-4 bg-gray-600 rounded animate-pulse w-1/2"></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-8 bg-gray-600 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-gray-600 rounded animate-pulse w-1/2"></div>
                <div className="flex justify-center items-center">
                  <div className="w-16 h-16 bg-gray-600 rounded-full animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-[#2a2f3e] border-gray-700">
            <CardHeader className="pb-3">
              <div className="h-4 bg-gray-600 rounded animate-pulse w-1/3"></div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-8 bg-gray-600 rounded animate-pulse w-2/3"></div>
              <div className="h-24 bg-gray-600 rounded animate-pulse"></div>
              {i === 2 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {[1, 2, 3, 4].map((j) => (
                    <div
                      key={j}
                      className="h-6 bg-gray-600 rounded animate-pulse w-16"
                    ></div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* General Information Skeleton */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">General Information</h2>
        </div>
        <Card className="bg-[#2a2f3e] border-gray-700">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-600 rounded animate-pulse w-1/2"></div>
                  <div className="h-6 bg-gray-600 rounded animate-pulse w-3/4"></div>
                  <div className="h-3 bg-gray-600 rounded animate-pulse w-1/3"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
