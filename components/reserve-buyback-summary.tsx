"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatPythAmount, formatUsd, formatUsdPerPyth } from "@/lib/buyback/format";

export function ReserveBuybackSummary() {
  const summary = useQuery(api.pythBuybackSnapshots.getPythBuybackSummary, {});

  if (!summary) {
    return (
      <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="flex items-center justify-center gap-2 p-6 text-[#a8a1bf]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading buyback metrics...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Buyback Metrics</h2>
          <p className="text-xs text-[#8f88a9]">
            {summary.trackingStartedMs
              ? `Tracking started ${new Date(summary.trackingStartedMs).toLocaleString()}`
              : "Tracking start pending first snapshot"}
            {" · "}
            {summary.lastUpdatedMs
              ? `Updated ${new Date(summary.lastUpdatedMs).toLocaleString()}`
              : "Waiting for first snapshot"}
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-xs text-[#b8b0d0]"
        >
          Council Ops USDC -&gt; PYTH
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-5">
        <Card className="rounded-[24px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0">
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs text-[#a8a1bf] sm:text-sm">Total USDC Spent</p>
            <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              {formatUsd(summary.totalUsdcSpent)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0">
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs text-[#a8a1bf] sm:text-sm">Total PYTH Bought</p>
            <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              {formatPythAmount(summary.totalPythBought)} PYTH
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0">
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs text-[#a8a1bf] sm:text-sm">Average Buy Price</p>
            <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              {summary.avgBuyPriceUsd > 0 ? formatUsdPerPyth(summary.avgBuyPriceUsd) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
