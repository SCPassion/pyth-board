"use client";

import { useGovernanceTotalStaked } from "@/hooks/use-governance-total-staked";
import { Users } from "lucide-react";

const formatTotal = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function GovernanceHeaderStat() {
  const { total, isLoading, retry } = useGovernanceTotalStaked();
  const title = total === null
    ? "Total PYTH staked in governance across the network"
    : `${total.toLocaleString("en-US", { maximumFractionDigits: 6 })} PYTH staked in governance across the network`;

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-[#2f2942] px-3 py-2 text-xs"
      title={title}
    >
      <Users className="h-3.5 w-3.5 shrink-0 text-[#8dfdd0]" aria-hidden="true" />
      <span className="text-[#b8b1cc]">Governance staked</span>
      <span className="font-data whitespace-nowrap text-white" role="status" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? "Loading…" : total === null ? "Unavailable" : `${formatTotal.format(total)} PYTH`}
      </span>
      {!isLoading && total === null ? (
        <button
          type="button"
          onClick={retry}
          className="rounded text-[#8dfdd0] underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8dfdd0]"
          aria-label="Retry governance total"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
