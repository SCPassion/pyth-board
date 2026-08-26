export type PythPriceHistoryPoint = {
  label: string;
  price: number;
  timestamp: number;
  tooltipLabel: string;
};

function formatTimeLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function formatTooltipLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

export function parsePythPriceHistory(data: unknown): PythPriceHistoryPoint[] {
  const prices = Array.isArray(
    (data as {
      coins?: {
        "coingecko:pyth-network"?: {
          prices?: unknown;
        };
      };
    })?.coins?.["coingecko:pyth-network"]?.prices
  )
    ? (data as {
        coins: {
          "coingecko:pyth-network": {
            prices: unknown[];
          };
        };
      }).coins["coingecko:pyth-network"].prices
    : [];

  return prices
    .map((entry: unknown) => {
      if (!entry || typeof entry !== "object") return null;
      const timestamp = Number((entry as { timestamp?: unknown }).timestamp);
      const price = Number((entry as { price?: unknown }).price);

      if (!Number.isFinite(timestamp) || !Number.isFinite(price)) {
        return null;
      }

      return {
        label: formatTimeLabel(timestamp),
        price,
        timestamp,
        tooltipLabel: formatTooltipLabel(timestamp),
      };
    })
    .filter(
      (point: PythPriceHistoryPoint | null): point is PythPriceHistoryPoint =>
        point !== null && Number.isFinite(point.price)
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}
