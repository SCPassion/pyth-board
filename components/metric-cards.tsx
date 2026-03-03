"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePythPriceHistory } from "@/hooks/use-pyth-price-history";
import { useWalletInfosStore } from "@/store/store";
import { TrendingUp, PieChart as PieChartIcon } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type MetricCardsProps = {
  pythPrice: number | null;
  totalStaked: number;
  totalClaimableRewards: number;
};

export function MetricCards({
  pythPrice,
  totalStaked,
}: MetricCardsProps) {
  const priceHistory = usePythPriceHistory();
  const wallets = useWalletInfosStore((state) => state.wallets);

  const walletData = wallets.map((wallet) => ({
    name: wallet.name,
    value: wallet.stakingInfo?.totalStakedPyth as number,
    percentage:
      totalStaked > 0
        ? (((wallet.stakingInfo?.totalStakedPyth as number) / totalStaked) * 100)
            .toFixed(1)
        : "0.0",
  }));

  const walletColors = walletData.map((_, index) => {
    const hue = (index * 137.508) % 360;
    return `hsl(${hue}, 32%, 42%)`;
  });

  const dayLow =
    priceHistory.length > 0
      ? Math.min(...priceHistory.map((point) => point.price))
      : null;
  const dayHigh =
    priceHistory.length > 0
      ? Math.max(...priceHistory.map((point) => point.price))
      : null;
  const yAxisPadding =
    dayLow !== null && dayHigh !== null
      ? Math.max((dayHigh - dayLow) * 0.18, 0.0005)
      : 0.001;
  const yAxisMin = dayLow !== null ? Math.max(dayLow - yAxisPadding, 0) : 0;
  const yAxisMax = dayHigh !== null ? dayHigh + yAxisPadding : "auto";

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Market Metrics
          </h2>
          <p className="mt-1 text-sm text-[#a8a1bf]">
            Live PYTH price and wallet spread.
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-xs text-[#b8b0d0]"
        >
          Live Data
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="group rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)] sm:col-span-2">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2a2238] ring-1 ring-white/8">
                  <TrendingUp className="h-4 w-4 text-[#8dfdd0]" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#bcb5d4] sm:text-sm">
                  Pyth Price
                </p>
              </div>
              <Badge
                variant="outline"
                className="rounded-xl border-white/8 bg-[#1f1830] px-3 py-1 text-xs text-[#cfc8e6]"
              >
                Live
              </Badge>
            </div>

            <p className="text-3xl font-bold text-white sm:text-4xl">
              ${pythPrice ? pythPrice.toFixed(4) : "..."} USD
            </p>

            <div className="space-y-4">
              <div className="h-40 rounded-[24px] bg-[rgba(23,16,36,0.42)] px-3 py-4 ring-1 ring-white/6 sm:h-44">
                {priceHistory.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={priceHistory}
                      margin={{ top: 4, right: 6, left: 6, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="pyth-price-gradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#4ade80"
                            stopOpacity={0.34}
                          />
                          <stop
                            offset="95%"
                            stopColor="#4ade80"
                            stopOpacity={0.03}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="rgba(255,255,255,0.06)"
                      />
                      <XAxis dataKey="label" hide axisLine={false} tickLine={false} />
                      <YAxis
                        domain={[yAxisMin, yAxisMax]}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                        tick={{ fill: "#8f88a9", fontSize: 10 }}
                        tickFormatter={(value: number) => `$${value.toFixed(2)}`}
                      />
                      <Tooltip
                        cursor={false}
                        labelFormatter={(value, payload) =>
                          payload?.[0]?.payload?.tooltipLabel || value
                        }
                        formatter={(value: number) => [
                          `$${value.toFixed(4)}`,
                          "PYTH",
                        ]}
                        contentStyle={{
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "0.75rem",
                          backgroundColor: "rgba(31, 24, 48, 0.96)",
                          color: "#f9fafb",
                        }}
                        itemStyle={{ color: "#f9fafb" }}
                        labelStyle={{ color: "#d1d5db" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#4ade80"
                        strokeWidth={2}
                        fill="url(#pyth-price-gradient)"
                        fillOpacity={1}
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: "#4ade80",
                          stroke: "#1b112d",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 text-xs text-[#8f88a9]">
                    Loading 24h price curve...
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#9b94b6]">
                <span>Past 24 hours</span>
                <span>
                  Low {dayLow !== null ? `$${dayLow.toFixed(4)}` : "..."} / High{" "}
                  {dayHigh !== null ? `$${dayHigh.toFixed(4)}` : "..."}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/10 bg-[#39324a] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2a2238] ring-1 ring-white/8">
                  <PieChartIcon className="h-4 w-4 text-[#8ad8ff]" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bcb5d4] sm:text-sm">
                  Wallet Distribution
                </p>
              </div>
              <Badge
                variant="outline"
                className="rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-xs text-[#cfc8e6]"
              >
                {wallets.length} Total
              </Badge>
            </div>

            <p className="text-3xl font-bold text-white">{wallets.length} Wallets</p>

            <div className="flex h-28 items-center justify-center rounded-[22px] bg-[#312940] ring-1 ring-white/6 sm:h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={walletData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {walletData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={walletColors[index % walletColors.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 sm:gap-x-3">
              {walletData.map((wallet, index) => (
                <div
                  key={wallet.name}
                  className="flex items-center gap-1 rounded-xl bg-[#2f2942] px-2 py-1 text-xs text-[#d7d1eb] sm:gap-2 sm:text-sm"
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-full sm:h-3 sm:w-3"
                    style={{
                      backgroundColor:
                        walletColors[index % walletColors.length],
                    }}
                  />
                  <span className="max-w-[8rem] truncate text-[#bcb5d4]">
                    {wallet.name}
                  </span>
                  <span className="font-medium text-white">
                    {wallet.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
