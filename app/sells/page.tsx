"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SellsSummaryBar } from "@/components/sells/sells-summary-bar";
import { WhaleCards } from "@/components/sells/whale-cards";
import { SellActivityFeed } from "@/components/sells/sell-activity-feed";
import { SellsAnalytics } from "@/components/sells/sells-analytics";
import { SellsTierFilter } from "@/components/sells/sells-tier-filter";
import { Badge } from "@/components/ui/badge";

export default function SellsPage() {
  const [tierFilter, setTierFilter] = useState<"all" | "dolphin" | "whale">("all");
  const trackingStart = useQuery(api.sells.getTrackingStartDate, {});
  const trackingSince = trackingStart
    ? new Date(trackingStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="space-y-5 w-full min-w-0 overflow-x-hidden px-1 sm:px-2 lg:px-3">

      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-[32px] border border-white/15 bg-[linear-gradient(135deg,rgba(40,28,70,0.96)_0%,rgba(70,35,110,0.88)_50%,rgba(140,50,110,0.8)_100%)] px-6 py-8 shadow-[0_20px_60px_rgba(9,5,20,0.4)] sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-500/20 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-32 left-[20%] h-64 w-64 rounded-full bg-pink-500/20 blur-[80px]" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between min-w-0">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-4xl">
                PYTH Sell Activity
              </h1>
              <Badge className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_20px_rgba(73,224,255,0.4)] backdrop-blur-md">
                BETA
              </Badge>
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
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Badge
                variant="outline"
                className="w-fit rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/70"
              >
                Webhook-powered · No polling
              </Badge>
              {trackingSince && (
                <Badge
                  variant="outline"
                  className="w-fit rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/70"
                >
                  Tracking since {trackingSince}
                </Badge>
              )}
            </div>
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
