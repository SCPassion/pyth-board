"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SellsAnalytics } from "@/components/sells/sells-analytics";
import { BuysAnalytics } from "@/components/sells/buys-analytics";
import { WhaleCards } from "@/components/sells/whale-cards";
import { WhaleBuyCards } from "@/components/sells/whale-buy-cards";
import { SellActivityFeed } from "@/components/sells/sell-activity-feed";
import { BuyActivityFeed } from "@/components/sells/buy-activity-feed";
import { SellsSummaryBar } from "@/components/sells/sells-summary-bar";
import { BuysSummaryBar } from "@/components/sells/buys-summary-bar";
import { TierFilter } from "@/components/sells/tier-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Mode = "sell" | "buy";

export default function ActivityPage() {
  const [mode, setMode] = useState<Mode>("sell");
  const [tierFilter, setTierFilter] = useState<"all" | "dolphin" | "whale">("all");

  const trackingStart = useQuery(api.activity.getTrackingStartDate, {});
  const trackingSince = trackingStart
    ? new Date(trackingStart).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const isSell = mode === "sell";

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
                {isSell ? "PYTH Sell Activity" : "PYTH Buy Activity"}
              </h1>
              <Badge className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_20px_rgba(73,224,255,0.4)] backdrop-blur-md">
                BETA
              </Badge>
            </div>
            <p className="max-w-xl text-sm text-white/80 sm:text-base">
              Tracking all on-chain PYTH {isSell ? "sell" : "buy"} events in real-time
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
            {isSell ? <SellsSummaryBar /> : <BuysSummaryBar />}
          </div>
        </div>
      </section>

      {/* Buy / Sell Toggle */}
      <div className="flex items-center justify-center gap-2 rounded-[24px] border border-white/8 bg-[#312940] p-2">
        <Button
          size="sm"
          variant={isSell ? "default" : "ghost"}
          className={
            isSell
              ? "h-10 rounded-2xl bg-[#6f4bd8] px-6 text-white hover:bg-[#7b57e3]"
              : "h-10 rounded-2xl px-6 text-[#b4aec8] hover:bg-white/5 hover:text-white"
          }
          onClick={() => { setMode("sell"); setTierFilter("all"); }}
        >
          Sell
        </Button>
        <Button
          size="sm"
          variant={!isSell ? "default" : "ghost"}
          className={
            !isSell
              ? "h-10 rounded-2xl bg-[#6f4bd8] px-6 text-white hover:bg-[#7b57e3]"
              : "h-10 rounded-2xl px-6 text-[#b4aec8] hover:bg-white/5 hover:text-white"
          }
          onClick={() => { setMode("buy"); setTierFilter("all"); }}
        >
          Buy
        </Button>
      </div>

      {/* Analytics */}
      {isSell ? <SellsAnalytics /> : <BuysAnalytics />}

      {/* Whale Cards */}
      {isSell ? <WhaleCards /> : <WhaleBuyCards />}

      {/* Notable Events */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            {isSell ? "Notable Sells" : "Notable Buys"}
          </h2>
          <TierFilter value={tierFilter} onChange={setTierFilter} />
        </div>
        {isSell
          ? <SellActivityFeed tierFilter={tierFilter} />
          : <BuyActivityFeed tierFilter={tierFilter} />
        }
      </div>

    </div>
  );
}
