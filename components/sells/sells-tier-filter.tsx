"use client";

import { cn } from "@/lib/utils";

type TierFilter = "all" | "dolphin" | "whale";

interface SellsTierFilterProps {
  value: TierFilter;
  onChange: (value: TierFilter) => void;
}

const FILTERS: { value: TierFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dolphin", label: "Dolphin" },
  { value: "whale", label: "Whale" },
];

export function SellsTierFilter({ value, onChange }: SellsTierFilterProps) {
  return (
    <div className="flex gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          aria-pressed={value === f.value}
          className={cn(
            "rounded-xl px-4 py-1.5 text-sm font-medium transition-colors",
            value === f.value
              ? "bg-white/15 text-white"
              : "text-[#a8a1bf] hover:bg-white/8 hover:text-white"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
