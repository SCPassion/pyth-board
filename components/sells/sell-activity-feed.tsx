"use client";

import { useState, useEffect } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount, truncateAddress, formatTimeAgo } from "@/lib/sells/format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const TIER_STYLES = {
  whale: {
    border: "border-l-red-500",
    badge: "border-red-400/30 bg-red-400/15 text-red-300",
    label: "Whale",
  },
  dolphin: {
    border: "border-l-amber-500",
    badge: "border-amber-400/30 bg-amber-400/15 text-amber-300",
    label: "Dolphin",
  },
} as const;

export function SellActivityFeed({
  tierFilter = "all",
}: {
  tierFilter?: "all" | "dolphin" | "whale";
}) {
  const [page, setPage] = useState(0);
  const { results, status, loadMore } = usePaginatedQuery(
    api.activity.getSellEvents,
    { tier: tierFilter === "all" ? undefined : tierFilter },
    { initialNumItems: PAGE_SIZE }
  );

  // Reset to first page when filter changes
  useEffect(() => { setPage(0); }, [tierFilter]);

  // Pre-fetch next page's data when approaching end of loaded results
  const neededForNextPage = (page + 2) * PAGE_SIZE;
  useEffect(() => {
    if (status === "CanLoadMore" && results.length < neededForNextPage) {
      loadMore(PAGE_SIZE);
    }
  }, [page, status, results.length, neededForNextPage, loadMore]);

  const pageItems = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasNextPage = results.length > (page + 1) * PAGE_SIZE || status === "CanLoadMore";
  const hasPrevPage = page > 0;
  const totalLoaded = results.length;
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalLoaded);

  if (status === "LoadingFirstPage") {
    return (
      <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="flex items-center justify-center gap-2 p-8 text-[#a8a1bf]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sell events...
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#312940] ring-1 ring-white/8">
            <ExternalLink className="h-8 w-8 text-[#a8a1bf]" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">No Sell Events Yet</h3>
          <p className="mx-auto max-w-sm text-sm text-[#b4aec8]">
            PYTH sell events will appear here once the webhook is active.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
      <CardHeader className="px-7 pt-7 pb-3 sm:px-8">
        <p className="text-xs text-[#a8a1bf]">
          Showing {start}–{end} of {status === "Exhausted" ? totalLoaded : `${totalLoaded}+`} sell events — newest first
        </p>
      </CardHeader>
      <CardContent className="space-y-2 px-7 pb-7 sm:px-8 sm:pb-8">

        {/* Table header — desktop only */}
        <div className="mb-3 hidden items-center gap-4 border-b border-white/8 pb-3 px-3 md:flex">
          <div className="w-24 shrink-0">
            <p className="text-xs font-medium text-[#8f88a9]">Tier</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#8f88a9]">Wallet</p>
          </div>
          <div className="w-32 text-right">
            <p className="text-xs font-medium text-[#8f88a9]">PYTH Sold</p>
          </div>
          <div className="w-24 text-right">
            <p className="text-xs font-medium text-[#8f88a9]">When</p>
          </div>
          <div className="w-4 shrink-0" />
        </div>

        {pageItems.map((event) => {
          const tier =
            TIER_STYLES[event.tier as keyof typeof TIER_STYLES] ??
            TIER_STYLES.dolphin;

          return (
            <a
              key={event._id}
              href={`https://solscan.io/tx/${event.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex items-center gap-4 rounded-2xl border-l-[3px] border border-white/5 bg-white/[0.02] p-3 transition-all duration-300 hover:-translate-y-[2px] hover:border-white/15 hover:bg-white/[0.04] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
                tier.border
              )}
            >
              {/* Mobile */}
              <div className="flex w-full flex-col gap-2 md:hidden">
                <div className="flex items-center justify-between">
                  <Badge className={cn("rounded-full border text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5", tier.badge)}>
                    {tier.label}
                  </Badge>
                  <span className="text-xs text-white/50">{formatTimeAgo(event.timestamp)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#d8d3ea]">{truncateAddress(event.fromAddress)}</span>
                  <span className="text-sm font-bold text-white">{formatPythAmount(event.pythAmount)} PYTH</span>
                </div>
                <div className="flex items-center justify-end text-xs text-white/50">
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden w-full items-center gap-4 md:flex">
                <div className="w-24 shrink-0">
                  <Badge className={cn("rounded-full border text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5", tier.badge)}>
                    {tier.label}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-[#d8d3ea]">{truncateAddress(event.fromAddress)}</span>
                </div>
                <div className="w-32 text-right">
                  <span className="text-sm font-bold text-white">{formatPythAmount(event.pythAmount)}</span>
                </div>
                <div className="w-24 text-right">
                  <span className="text-xs text-[#a8a1bf]">{formatTimeAgo(event.timestamp)}</span>
                </div>
                <div className="w-4 shrink-0 transform transition-transform duration-300 group-hover:-translate-y-[2px] group-hover:translate-x-[2px]">
                  <ExternalLink className="h-4 w-4 text-[#8f88a9] transition-colors group-hover:text-white" />
                </div>
              </div>
            </a>
          );
        })}

        {/* Pagination controls */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasPrevPage}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl px-3 text-[#b4aec8] hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <span className="text-xs text-[#a8a1bf]">Page {page + 1}</span>

          <Button
            variant="ghost"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl px-3 text-[#b4aec8] hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
