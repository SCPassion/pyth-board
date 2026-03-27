"use client";

import { useState } from "react";
import { SellsSummaryBar } from "@/components/sells/sells-summary-bar";
import { WhaleCards } from "@/components/sells/whale-cards";
import { SellActivityFeed } from "@/components/sells/sell-activity-feed";
import { SellsAnalytics } from "@/components/sells/sells-analytics";
import { SellsTierFilter } from "@/components/sells/sells-tier-filter";
import { Badge } from "@/components/ui/badge";

export default function SellsPage() {
  const [tierFilter, setTierFilter] = useState<"all" | "dolphin" | "whale">("all");

  return (
    <div className="space-y-5 w-full min-w-0 overflow-x-hidden px-1 sm:px-2 lg:px-3">

      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(47,34,82,0.96)_0%,rgba(93,47,141,0.88)_54%,rgba(181,88,152,0.72)_100%)] px-6 py-7 shadow-[0_28px_70px_rgba(9,5,20,0.28)] sm:px-8">
        <div className="pointer-events-none absolute -right-8 top-2 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-28px] left-[38%] h-24 w-24 rounded-full bg-red-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                PYTH Sell Activity
              </h1>
              <div className="flex items-center gap-1.5 rounded-full border border-green-400/30 bg-green-400/15 px-2.5 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] font-semibold text-green-300">Live</span>
              </div>
            </div>
            <p className="max-w-xl text-sm text-white/80 sm:text-base">
              Tracking all on-chain PYTH sell events in real-time
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                🦐 <span className="font-medium text-white/90">Shrimp</span> &lt; 10K PYTH
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                🐬 <span className="font-medium text-white/90">Dolphin</span> 10K – 50K PYTH
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                🐋 <span className="font-medium text-white/90">Whale</span> &gt; 50K PYTH
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <Badge
              variant="outline"
              className="w-fit rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/70"
            >
              Webhook-powered · No polling
            </Badge>
            <SellsSummaryBar />
          </div>
        </div>
      </section>

      {/* Sell Pressure Analytics */}
      <SellsAnalytics />

      {/* Whale Cards — hidden when no whale events exist */}
      <WhaleCards />

      {/* Notable Sells */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Notable Sells</h2>
          <SellsTierFilter value={tierFilter} onChange={setTierFilter} />
        </div>
        <SellActivityFeed tierFilter={tierFilter} />
      </div>

    </div>
  );
}
