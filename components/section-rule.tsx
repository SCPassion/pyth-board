import type { ReactNode } from "react";

/** Ledger-style rule used to open a page section: index / title / hairline. */
export function SectionRule({
  index,
  title,
  description,
  right,
}: {
  index: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3 sm:gap-4">
        <span className="font-data shrink-0 text-[11px] tracking-[0.3em] text-cyan-300/50">
          {index}
        </span>
        <h2 className="font-display shrink-0 text-xl text-white sm:text-2xl">
          {title}
        </h2>
        <div className="h-px min-w-8 flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {description ? (
        <p className="max-w-2xl pl-[2.6rem] text-sm text-[#a8a1bf] sm:pl-[3.2rem]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
