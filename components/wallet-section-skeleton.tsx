"use client";

import { Card, CardContent } from "@/components/ui/card";

function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/10 ${className}`} />;
}

export function WalletSectionSkeleton() {
  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_50px_rgba(9,5,20,0.18)]">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <PulseBlock className="h-11 w-11 rounded-2xl" />
              <PulseBlock className="h-7 w-40 rounded-2xl" />
            </div>
            <PulseBlock className="h-4 w-72 max-w-full rounded-xl" />
            <PulseBlock className="h-4 w-80 max-w-full rounded-xl" />
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <PulseBlock className="h-9 w-32 rounded-2xl" />
            <PulseBlock className="h-10 w-40 rounded-2xl" />
            <PulseBlock className="h-4 w-24 rounded-xl" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-3xl bg-black/12 p-4 ring-1 ring-white/8"
            >
              <PulseBlock className="h-3 w-24 rounded-lg" />
              <PulseBlock className="mt-3 h-8 w-20 rounded-2xl" />
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-white/8 bg-[#2f2942]/65 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <PulseBlock className="h-7 w-40 rounded-2xl" />
              <PulseBlock className="h-4 w-56 rounded-xl" />
            </div>
            <PulseBlock className="h-10 w-full rounded-2xl sm:w-64" />
          </div>

          <div className="space-y-3">
            <div className="hidden grid-cols-[1.4fr_0.8fr_0.6fr] gap-4 border-b border-white/8 pb-3 sm:grid">
              <PulseBlock className="h-4 w-36 rounded-xl" />
              <PulseBlock className="h-4 w-20 rounded-xl" />
              <PulseBlock className="h-4 w-12 rounded-xl" />
            </div>

            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className="grid gap-3 rounded-2xl bg-black/10 px-3 py-3 sm:grid-cols-[1.4fr_0.8fr_0.6fr] sm:gap-4"
              >
                <div className="flex items-center gap-3">
                  <PulseBlock className="h-8 w-8 rounded-full" />
                  <PulseBlock className="h-4 w-44 rounded-xl" />
                </div>
                <PulseBlock className="h-5 w-24 rounded-xl sm:mx-auto" />
                <PulseBlock className="h-5 w-16 rounded-xl sm:mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
