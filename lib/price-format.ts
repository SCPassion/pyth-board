export function formatUsdPriceTick(value: number) {
  if (!Number.isFinite(value)) {
    return "$0.0000";
  }

  if (Math.abs(value) < 1) {
    return `$${value.toFixed(4)}`;
  }

  return `$${value.toFixed(2)}`;
}
