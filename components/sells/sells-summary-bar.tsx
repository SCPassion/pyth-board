"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount } from "@/lib/sells/format";

export function SellsSummaryBar() {
  const summary = useQuery(api.activity.getSellsSummary, {});
  const loading = summary === undefined;

  const StatPill = ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => (
    <div className="group relative flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-4 py-2 shadow-inner transition-all duration-300 hover:border-white/20 hover:bg-black/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]">
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">{label}</span>
      {loading ? (
        <div className="h-4 w-16 animate-pulse rounded bg-white/15" />
      ) : (
        <span className="text-sm font-bold text-white drop-shadow-sm">{value}</span>
      )}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatPill
        label="24h"
        value={`${formatPythAmount(summary?.last24h.totalPythSoldAllTiers ?? 0)} PYTH`}
      />
      <StatPill
        label="7d"
        value={`${formatPythAmount(summary?.last7d.totalPythSoldAllTiers ?? 0)} PYTH`}
      />
      <StatPill
        label="30d"
        value={`${formatPythAmount(summary?.last30d.totalPythSoldAllTiers ?? 0)} PYTH`}
      />
    </div>
  );
}
