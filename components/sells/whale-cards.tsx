"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPythAmount, truncateAddress, formatTimeAgo } from "@/lib/sells/format";
import { ExternalLink } from "lucide-react";

export function WhaleCards() {
  const events = useQuery(api.sells.getWhaleSellEvents, {});

  // Hide section entirely when loading or empty — no skeleton, no empty state
  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white sm:text-2xl">Whale Events</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <a
            key={event._id}
            href={`https://solscan.io/tx/${event.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-[24px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(180,83,9,0.18)_0%,rgba(120,53,15,0.12)_100%)] p-5 transition-all duration-200 hover:border-amber-400/40 hover:scale-[1.01]"
          >
            <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />

            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300">
                  🐋 Whale
                </span>
                <ExternalLink className="h-4 w-4 text-white/40 transition-colors group-hover:text-white/70" />
              </div>

              <p className="text-2xl font-bold text-white">
                {formatPythAmount(event.pythAmount)}{" "}
                <span className="text-base font-normal text-white/60">PYTH</span>
              </p>

              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-[#d8d3ea]">
                  {truncateAddress(event.fromAddress)}
                </span>
                <span className="text-white/50">{formatTimeAgo(event.timestamp)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
