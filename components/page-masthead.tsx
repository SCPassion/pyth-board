import type { ReactNode } from "react";

/**
 * Shared editorial masthead used to open every page (except Reserve, which
 * has its own dedicated ledger header): thin accent rule, mono eyebrow,
 * italic serif title, and an optional right-aligned meta/action slot.
 */
export function PageMasthead({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="relative border-b border-white/10 pb-10 sm:pb-12">
      <div
        aria-hidden
        className="absolute -top-1 left-0 h-px w-full bg-gradient-to-r from-cyan-400/70 via-fuchsia-400/60 to-transparent"
      />
      <div className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-4">
          <p className="font-data text-[11px] uppercase tracking-[0.32em] text-cyan-300/70">
            {eyebrow}
          </p>
          <h1 className="font-display text-3xl italic leading-tight text-white sm:text-4xl lg:text-[2.75rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              {description}
            </p>
          ) : null}
        </div>

        {right ? (
          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
            {right}
          </div>
        ) : null}
      </div>
    </header>
  );
}
