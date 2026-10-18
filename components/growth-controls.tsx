"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const growthSelectClassName = "min-h-9 rounded-lg border border-white/20 bg-[#292238] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:border-white/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";
export const growthActionClassName = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 hover:border-white/30 hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

export function growthFilterClassName(active: boolean) {
  return cn("inline-flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-300",
    active ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/15 bg-white/[0.04] text-white/75 hover:border-white/30 hover:bg-white/[0.08]");
}

/** The same selected-state treatment for compact periods and more prominent view switches. */
export function GrowthSegmentedControl<T extends string>({ label, value, options, onChange, size = "sm", className }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: LucideIcon }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return <div role="group" aria-label={label} className={cn("inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border border-white/15 bg-black/20 p-1", className)}>
    {options.map(option => {
      const selected = value === option.value;
      const Icon = option.icon;
      return <button key={option.value} type="button" aria-pressed={selected} onClick={() => onChange(option.value)}
        className={cn("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300",
          size === "md" ? "min-h-10 px-4 py-2 text-sm" : "min-h-8 px-3 py-1.5 text-xs",
          selected ? "border-cyan-300/45 bg-cyan-300/20 text-cyan-100 shadow-sm" : "border-transparent text-white/65 hover:border-white/15 hover:bg-white/[0.06] hover:text-white")}>
        {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
        {option.label}
      </button>;
    })}
  </div>;
}
