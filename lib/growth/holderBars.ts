/** All bar segments share one raw-token scale. Never convert token balances to floats. */
export function holderBarBalances(amount: string, delta: string | null | undefined) {
  const current = BigInt(amount);
  const previous = delta == null ? current : current - BigInt(delta);
  return { current, previous, retained: current < previous ? current : previous,
    added: current > previous ? current - previous : 0n,
    removed: previous > current ? previous - current : 0n };
}

export function holderBarWidths(amount: string, delta: string | null | undefined, scale: bigint) {
  const balances = holderBarBalances(amount, delta);
  const width = (value: bigint) => scale > 0n ? Number(value * 1_000_000n / scale) / 10_000 : 0;
  return { retained: width(balances.retained), added: width(balances.added), removed: width(balances.removed) };
}
