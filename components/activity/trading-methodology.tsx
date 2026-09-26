const routers = [
  {
    name: "Jupiter",
    detail: "Swap routes, verified original Recurring/DCA fills, legacy Trigger V1 fills, and top-level RFQ V1 fills.",
  },
  {
    name: "Titan",
    detail: "Verified swaps, including split fills.",
  },
  {
    name: "OKX DEX",
    detail: "Verified legacy and V3 customer settlements.",
  },
  {
    name: "Other routed swaps",
    detail: "Verified Raydium Router and Whirlpool wrapper executions.",
  },
] as const;

const pools = [
  { name: "Orca Whirlpool", detail: "swap and swap_v2" },
  { name: "Raydium", detail: "CLMM, CPMM, and LaunchLab swap shapes" },
  { name: "Meteora", detail: "DLMM classic swap and DAMM v2 swap" },
] as const;

export function TradingMethodology() {
  return (
    <details
      id="activity-methodology"
      open
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 focus-visible:outline-2 focus-visible:outline-cyan-300 sm:px-6">
        <span>
          <span className="font-data text-[10px] uppercase tracking-[0.22em] text-cyan-200/70">
            Coverage
          </span>
          <span className="mt-1 block font-display text-xl italic text-white sm:text-2xl">
            Supported PYTH trades
          </span>
        </span>
        <span aria-hidden className="text-xl text-white/45 transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-6 border-t border-white/10 px-5 py-5 text-sm leading-relaxed text-white/70 sm:px-6 sm:py-6">
        <p className="max-w-4xl">
          We count verified PYTH buys and sells delivered to this indexer.
          Jupiter, Titan, and OKX routes can pass through different inner pools
          when the customer&apos;s complete exchange is proven.
        </p>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <section aria-labelledby="activity-routers-title">
            <h3 id="activity-routers-title" className="font-medium text-cyan-200">Routers and order fills</h3>
            <ul className="mt-2 divide-y divide-white/10">
              {routers.map((router) => (
                <li key={router.name} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <span className="font-medium text-white/90">{router.name}</span>
                  <span>{router.detail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="activity-pools-title">
            <h3 id="activity-pools-title" className="font-medium text-violet-200">Direct pool executions</h3>
            <ul className="mt-2 divide-y divide-white/10">
              {pools.map((pool) => (
                <li key={pool.name} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr] sm:gap-4 lg:grid-cols-1 lg:gap-0">
                  <span className="font-medium text-white/90">{pool.name}</span>
                  <span>{pool.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-3 border-t border-white/10 pt-5 text-xs text-white/60 md:grid-cols-2">
          <p>
            PYTH used only between route legs, token transfers, order deposits,
            cancellations, and claims are not trades. DFlow as the outer router
            is held for review. Current Trigger V2 order attribution is not
            verified; a qualifying swap can still appear as a swap.
          </p>
          <p>
            Coverage is partial: Helius missed PYTH trades in live checks,
            collection has been paused, and there is no automatic backfill.
            Totals include only verified trades delivered while collection ran.
          </p>
        </div>
      </div>
    </details>
  );
}
