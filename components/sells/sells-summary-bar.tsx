"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount } from "@/lib/sells/format";

export function SellsSummaryBar() {
  const summary = useQuery(api.sells.getSellsSummary, {});
  const loading = summary === undefined;

  const StatPill = ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2">
      <span className="text-xs text-white/60">{label}</span>
      {loading ? (
        <div className="h-4 w-16 animate-pulse rounded bg-white/15" />
      ) : (
        <span className="text-sm font-bold text-white">{value}</span>
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
