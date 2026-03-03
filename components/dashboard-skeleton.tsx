"use client";

import { Card, CardContent } from "@/components/ui/card";

function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/10 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <PulseBlock className="h-8 w-48" />
          <div className="flex items-center gap-2">
            <PulseBlock className="h-7 w-20 rounded-xl" />
            <PulseBlock className="h-7 w-24 rounded-xl" />
          </div>
        </div>

        <Card className="relative overflow-hidden rounded-[28px] border-white/10 bg-[linear-gradient(135deg,rgba(182,88,165,0.95)_0%,rgba(65,30,220,0.9)_100%)] py-0 shadow-[0_28px_80px_rgba(13,5,30,0.35)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/12 blur-2xl" />
          <div className="pointer-events-none absolute bottom-[-36px] right-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />
          <CardContent className="relative p-6 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <div className="space-y-3">
                  <PulseBlock className="h-3 w-36 rounded-lg bg-white/15" />
                  <PulseBlock className="h-14 w-48 rounded-3xl bg-white/20" />
                  <PulseBlock className="h-6 w-20 rounded-xl bg-white/15" />
                  <PulseBlock className="h-4 w-full max-w-md rounded-xl bg-white/12" />
                  <PulseBlock className="h-4 w-full max-w-xs rounded-xl bg-white/12" />
                </div>
                <PulseBlock className="h-11 w-44 rounded-2xl bg-[#23144d]/80" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[1, 2].map((index) => (
                  <div
                    key={index}
                    className="rounded-3xl bg-black/18 p-4 ring-1 ring-white/10"
                  >
                    <PulseBlock className="mb-3 h-11 w-11 rounded-2xl bg-white/10" />
                    <PulseBlock className="h-3 w-28 rounded-lg bg-white/15" />
                    <PulseBlock className="mt-3 h-8 w-24 rounded-2xl bg-white/20" />
                    <PulseBlock className="mt-3 h-3 w-36 rounded-lg bg-white/12" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <PulseBlock className="h-8 w-44" />
            <PulseBlock className="mt-2 h-4 w-48 rounded-xl" />
          </div>
          <PulseBlock className="h-7 w-20 rounded-xl" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)] sm:col-span-2">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PulseBlock className="h-8 w-8 rounded-xl" />
                  <PulseBlock className="h-4 w-24 rounded-xl" />
                </div>
                <PulseBlock className="h-6 w-12 rounded-xl" />
              </div>
              <PulseBlock className="h-10 w-44 rounded-2xl" />
              <div className="h-40 rounded-[24px] bg-[rgba(23,16,36,0.42)] p-4 ring-1 ring-white/6 sm:h-44">
                <PulseBlock className="h-full w-full rounded-[20px] border border-white/8 bg-white/5" />
              </div>
              <div className="flex items-center justify-between">
                <PulseBlock className="h-3 w-20 rounded-lg" />
                <PulseBlock className="h-3 w-28 rounded-lg" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/10 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PulseBlock className="h-8 w-8 rounded-xl" />
                  <PulseBlock className="h-4 w-32 rounded-xl" />
                </div>
                <PulseBlock className="h-6 w-14 rounded-xl" />
              </div>
              <PulseBlock className="h-10 w-32 rounded-2xl" />
              <div className="flex h-28 items-center justify-center rounded-[22px] bg-[#312940] ring-1 ring-white/6 sm:h-32">
                <PulseBlock className="h-16 w-16 rounded-full" />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <PulseBlock className="h-7 w-20 rounded-xl" />
                <PulseBlock className="h-7 w-24 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <PulseBlock className="h-8 w-44" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <Card
              key={index}
              className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_50px_rgba(9,5,20,0.18)]"
            >
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <PulseBlock className="h-11 w-11 rounded-2xl" />
                  <div className="space-y-2">
                    <PulseBlock className="h-3 w-28 rounded-lg" />
                    <PulseBlock className="h-6 w-20 rounded-xl" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
