import type { ParsedDouroReport } from "./forum";

export type DouroRevenuePoint = {
  label: string;
  reportTitle: string;
  reportUrl: string;
  timestampMs: number;
  monthlyGrossRevenueUsd: number | null;
  monthlyDaoShareUsd: number | null;
  monthlyDouroLabsUsd: number | null;
  cumulativeGrossRevenueUsd: number | null;
  cumulativeDaoShareUsd: number | null;
  cumulativeDouroLabsUsd: number | null;
  distributionUsd: number | null;
};

export type ProductRevenueSeries = {
  products: string[];
  primaryProduct: string | null;
  secondaryProducts: string[];
  points: Array<Record<string, number | string | null>>;
};

export function buildDouroRevenueSeries(
  reports: ParsedDouroReport[]
): DouroRevenuePoint[] {
  return sortReports(reports).map((report) => ({
    label: formatReportLabel(report),
    reportTitle: report.title,
    reportUrl: report.url,
    timestampMs: report.createdAtMs,
    monthlyGrossRevenueUsd: toNullable(report.monthlyGrossRevenueUsd),
    monthlyDaoShareUsd: toNullable(report.monthlyDaoShareUsd),
    monthlyDouroLabsUsd: toNullable(report.monthlyDouroLabsUsd),
    cumulativeGrossRevenueUsd: toNullable(report.cumulativeGrossRevenueUsd),
    cumulativeDaoShareUsd: toNullable(report.cumulativeDaoShareUsd),
    cumulativeDouroLabsUsd: toNullable(report.cumulativeDouroLabsUsd),
    distributionUsd: toNullable(report.distribution?.usdValue),
  }));
}

export function buildProductRevenueSeries(
  reports: ParsedDouroReport[]
): ProductRevenueSeries {
  const sortedReports = sortReports(reports);
  const products = [
    ...new Set(
      sortedReports.flatMap((report) =>
        report.monthlyRevenueRows
          .filter((row) => !row.isTotal)
          .map((row) => row.product)
      )
    ),
  ];

  const points = sortedReports.map((report) => {
    const point: Record<string, number | string | null> = {
      label: formatReportLabel(report),
      timestampMs: report.createdAtMs,
    };
    for (const product of products) {
      const row = report.monthlyRevenueRows.find(
        (candidate) => !candidate.isTotal && candidate.product === product
      );
      point[product] = row?.grossRevenueUsd ?? null;
    }
    return point;
  });

  const primaryProduct = findPrimaryProduct(products, points);
  const secondaryProducts = products.filter(
    (product) => product !== primaryProduct
  );

  return { products, primaryProduct, secondaryProducts, points };
}

function findPrimaryProduct(
  products: string[],
  points: Array<Record<string, number | string | null>>
): string | null {
  let primaryProduct: string | null = null;
  let highestValue = -Infinity;

  for (const product of products) {
    const productMax = Math.max(
      ...points.map((point) => {
        const value = point[product];
        return typeof value === "number" ? value : 0;
      })
    );

    if (productMax > highestValue) {
      highestValue = productMax;
      primaryProduct = product;
    }
  }

  return primaryProduct;
}

function sortReports(reports: ParsedDouroReport[]): ParsedDouroReport[] {
  return [...reports].sort((a, b) => a.createdAtMs - b.createdAtMs);
}

function toNullable(value: number | undefined): number | null {
  return value ?? null;
}

function formatReportLabel(report: ParsedDouroReport): string {
  const explicitMonth = report.title.match(
    /(?:Report(?: on Commercial Progress)?\s*[-–—]\s*)?([A-Z][a-z]+)\s+(\d{4})/
  );
  if (explicitMonth) {
    return `${explicitMonth[1].slice(0, 3)} ${explicitMonth[2]}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(report.createdAtMs));
}
