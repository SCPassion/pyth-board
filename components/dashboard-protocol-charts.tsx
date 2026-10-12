"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ReservePythBoughtChart } from "@/components/reserve-pyth-bought-chart";
import { PriceFeedsPanel } from "@/components/price-feeds-panel";
import { RevenueTrendChart } from "@/components/revenue-trend-chart";
import { buildDouroRevenueSeries } from "@/lib/pyth-pro/history";

function RevenuePreview() {
  const reports = useQuery(api.pythPro.listReports, { limit: 24 });
  const data = useMemo(() => buildDouroRevenueSeries(reports ?? []), [reports]);

  return (
    <RevenueTrendChart data={data} compact isLoading={reports === undefined} />
  );
}

export function DashboardProtocolCharts() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {[
        {
          label: "Price feeds",
          chart: <PriceFeedsPanel compact />,
          href: "/growth",
          link: "Explore feed growth",
        },
        {
          label: "On-chain buybacks",
          chart: <ReservePythBoughtChart compact />,
          href: "/reserve",
          link: "Explore the reserve",
        },
        {
          label: "Revenue",
          chart: <RevenuePreview />,
          href: "/revenue",
          link: "Explore revenue",
        },
      ].map(({ label, chart, href, link }) => (
        <article
          key={href}
          aria-label={label}
          className="flex min-w-0 flex-col rounded-[24px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[0_20px_50px_rgba(9,5,20,0.18)] sm:p-5"
        >
          <div className="min-w-0 flex-1">{chart}</div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 rounded-sm text-sm text-cyan-200 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            >
              {link} <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
