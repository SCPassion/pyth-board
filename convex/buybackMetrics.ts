export type BuybackSourceTotals = {
  totalUsdcSpentDca: number;
  totalPythBoughtDca: number;
  totalUsdcSpentLimitOrders: number;
  totalPythBoughtLimitOrders: number;
};

export function reconcileBuybackSourceTotals({
  previous,
  next,
}: {
  previous: Partial<BuybackSourceTotals> | null | undefined;
  next: BuybackSourceTotals;
}): BuybackSourceTotals {
  return {
    totalUsdcSpentDca: Math.max(
      previous?.totalUsdcSpentDca ?? 0,
      next.totalUsdcSpentDca
    ),
    totalPythBoughtDca: Math.max(
      previous?.totalPythBoughtDca ?? 0,
      next.totalPythBoughtDca
    ),
    totalUsdcSpentLimitOrders: Math.max(
      previous?.totalUsdcSpentLimitOrders ?? 0,
      next.totalUsdcSpentLimitOrders
    ),
    totalPythBoughtLimitOrders: Math.max(
      previous?.totalPythBoughtLimitOrders ?? 0,
      next.totalPythBoughtLimitOrders
    ),
  };
}

export function shouldFetchNextRecurringPage({
  currentPage,
  returnedOrderCount,
  hasMoreData,
  totalPages,
}: {
  currentPage: number;
  returnedOrderCount: number;
  hasMoreData?: boolean;
  totalPages?: number;
}): boolean {
  if (returnedOrderCount === 0) {
    return false;
  }

  return hasMoreData === true || currentPage < (totalPages ?? currentPage);
}

export function getJupiterRetryDelayMs({
  attempt,
  status,
  retryAfterHeader,
}: {
  attempt: number;
  status: number;
  retryAfterHeader: string | null;
}): number | null {
  if (attempt >= 3 || (status !== 429 && status < 500)) {
    return null;
  }

  const retryAfterSeconds =
    retryAfterHeader === null ? NaN : Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1_000, 10_000);
  }

  return Math.min(2 ** attempt * 1_000, 8_000);
}
