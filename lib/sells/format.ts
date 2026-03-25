export function formatPythAmount(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return m % 1 === 0
      ? `${m}M`
      : `${m.toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  if (amount >= 10_000) {
    const k = amount / 1_000;
    return k % 1 === 0
      ? `${k}K`
      : `${k.toFixed(1).replace(/\.?0+$/, "")}K`;
  }
  return new Intl.NumberFormat("en-US").format(Math.round(amount));
}

export function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export function formatTimeAgo(timestampMs: number): string {
  const seconds = Math.floor((Date.now() - timestampMs) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
