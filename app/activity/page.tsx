import { PageMasthead } from "@/components/page-masthead";
import { ActivityErrorBoundary } from "@/components/activity/activity-error-boundary";
import { TradingPanel } from "@/components/activity/trading-panel";

export default function ActivityPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageMasthead
        eyebrow="Network / Trading activity"
        title="PYTH trading activity."
        description="Observed PYTH buys and sells across verified executions and routes."
        right={
          <>
            <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 font-data text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
              Beta
            </span>
            <span className="font-data text-[11px] uppercase tracking-[0.2em] text-white/50">
              Solana · UTC
            </span>
          </>
        }
      />
      <ActivityErrorBoundary>
        <TradingPanel />
      </ActivityErrorBoundary>
    </div>
  );
}
