import type { RevenueRow } from "@/lib/pyth-pro/forum";

export type RevenueBreakdownSection = {
  key: "monthly" | "cumulative";
  title: string;
  description: string;
  rows: RevenueRow[];
};

export function buildRevenueBreakdownSections({
  monthlyRows,
  cumulativeRows,
  reportPeriodLabel,
}: {
  monthlyRows: RevenueRow[];
  cumulativeRows: RevenueRow[];
  reportPeriodLabel?: string;
}): RevenueBreakdownSection[] {
  const sections: RevenueBreakdownSection[] = [];

  if (monthlyRows.length > 0) {
    sections.push({
      key: "monthly",
      title: "Monthly revenue breakdown",
      description: reportPeriodLabel
        ? `${reportPeriodLabel} reporting period`
        : "Current reporting period",
      rows: monthlyRows,
    });
  }

  if (cumulativeRows.length > 0) {
    sections.push({
      key: "cumulative",
      title: "Cumulative revenue breakdown",
      description: "Accumulated since Sept 2025",
      rows: cumulativeRows,
    });
  }

  return sections;
}
