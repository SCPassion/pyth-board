"use client";

import { cn } from "@/lib/utils";

type TierFilterValue = "all" | "dolphin" | "whale";

interface TierFilterProps {
  value: TierFilterValue;
  onChange: (value: TierFilterValue) => void;
}

const FILTERS: { value: TierFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dolphin", label: "Dolphin" },
  { value: "whale", label: "Whale" },
];

export function TierFilter({ value, onChange }: TierFilterProps) {
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
