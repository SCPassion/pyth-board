import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-white/8 bg-[#241b35] px-5 py-5 shadow-[0_-16px_40px_rgba(9,5,20,0.16)] sm:px-6 sm:py-4 lg:px-8",
        className
      )}
    >
      <div className="flex max-w-none items-start gap-3 sm:items-center sm:gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-100 ring-1 ring-cyan-200/20 sm:h-9 sm:w-9">
          <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
        <p className="max-w-[1480px] text-[11px] font-medium leading-5 text-[#d7d2e6] sm:text-xs sm:leading-6 xl:max-w-none">
          Pyth Board is an independent, community-built project. It is not
          developed, operated, endorsed, or verified by the Pyth Data
          Association, Douro Labs, or any Pyth Network data publisher. Data is
          provided as is, with no warranty as to accuracy or availability. PYTH
          and the Pyth logo are trademarks of the Pyth Data Association and are
          used here for identification purposes only.
        </p>
      </div>
    </footer>
  );
}
