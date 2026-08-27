export const DEFAULT_REVENUE_TREND_KEYS = [
  "cumulativeGrossRevenueUsd",
] as const;

const DEFAULT_PRODUCT_REVENUE_KEYS = ["Pyth Pro", "LaaS", "Indices"] as const;

export function getDefaultRevenueTrendKeys(): string[] {
  return [...DEFAULT_REVENUE_TREND_KEYS];
}

export function getDefaultProductRevenueKeys({
  primaryProduct,
  products,
}: {
  primaryProduct: string | null;
  products: string[];
}): string[] {
  const defaultProducts = DEFAULT_PRODUCT_REVENUE_KEYS.filter((product) =>
    products.includes(product)
  );
  if (defaultProducts.length > 0) return defaultProducts;
  if (primaryProduct) return [primaryProduct];
  return products.slice(0, 1);
}

export function toggleVisibleSeries(currentKeys: string[], key: string): string[] {
  if (!currentKeys.includes(key)) {
    return [...currentKeys, key];
  }

  if (currentKeys.length === 1) {
    return currentKeys;
  }

  return currentKeys.filter((currentKey) => currentKey !== key);
}
