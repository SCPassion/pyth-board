"use client";

import { useId, useMemo } from "react";
import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { IsolatedSnapshotDot } from "@/components/isolated-snapshot-dot";
import { isolatedSnapshotTimes } from "@/lib/growth/chartHistory";
import {
  buildPriceFeedChart, PRICE_FEED_STATUSES, priceFeedVisibleScale,
  type PriceFeedSeries, type PriceFeedSnapshot,
} from "@/lib/growth/priceFeeds";

const number = new Intl.NumberFormat("en-US");
const signedNumber = new Intl.NumberFormat("en-US", { signDisplay: "exceptZero" });
const dateLabel = (time: number) => new Date(time).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

export function PriceFeedCountCharts({ snapshots, visibleKeys, config }: {
  snapshots: PriceFeedSnapshot[];
  visibleKeys: readonly PriceFeedSeries[];
  config: Record<PriceFeedSeries, { label: string; color: string }>;
}) {
  const syncId = useId();
  const data = useMemo(() => buildPriceFeedChart(snapshots), [snapshots]);
  const isolatedTimes = useMemo(() => isolatedSnapshotTimes(snapshots), [snapshots]);
  const keys = (["total", ...PRICE_FEED_STATUSES] as const).filter(key => visibleKeys.includes(key));
  const first = data[0];
  const last = data.at(-1);
  if (!first || !last) return null;

  return (
    <div className={`mt-4 grid gap-4 ${keys.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
      {keys.map(key => {
        const { label, color } = config[key];
        const scale = priceFeedVisibleScale(data, [key], "counts");
        const start = first[key]!;
        const end = last[key]!;
        const change = end - start;
        return (
          <article key={key} aria-label={`${label} feed counts`}
            className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-sm font-medium" style={{ color }}>
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />{label}
              </h4>
              <p className="font-data text-xs tabular-nums" style={{ color: change === 0 ? "#a8a1bf" : color }}>
                {change === 0 ? "No change" : `${signedNumber.format(change)} ${Math.abs(change) === 1 ? "feed" : "feeds"}`}
              </p>
            </div>
            <p className="mt-2 text-xs text-white/60">
              <span className="font-data tabular-nums text-white/85">{number.format(start)} → {number.format(end)}</span> feeds
              {start > 0 && change !== 0 && <> · {signedNumber.format(Number((change / start * 100).toFixed(2)))}%</>}
            </p>
            <ChartContainer config={config} className="mt-3 h-[180px] w-full aspect-auto"
              aria-label={`${label}: ${number.format(start)} to ${number.format(end)} feeds. Independent zoomed count scale.`}>
              <LineChart accessibilityLayer data={data} syncId={syncId} syncMethod="value"
                margin={{ left: 0, right: 56, top: 12, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} scale="time"
                  tickFormatter={dateLabel} tick={{ fill: "#a8a1bf", fontSize: 11 }}
                  tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis domain={scale.domain} ticks={scale.ticks} allowDecimals={false} width={52}
                  tickFormatter={value => number.format(value)} tick={{ fill: "#a8a1bf", fontSize: 11 }}
                  tickLine={false} axisLine={false} />
                <ChartTooltip content={({ active, payload, label: time }) => active && payload?.some(item => item.value != null) ? (
                  <div className="rounded-xl border border-white/25 bg-[#241b35] p-3 text-xs text-white shadow-lg">
                    <p className="text-white/65">{new Date(Number(time)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })} · UTC</p>
                    <p className="mt-1 flex justify-between gap-5" style={{ color }}>
                      <span>{label}</span><span className="font-data tabular-nums">{number.format(Number(payload.find(item => item.value != null)?.value))}</span>
                    </p>
                  </div>
                ) : null} />
                <Line dataKey={key} name={label} type="linear" stroke={color} strokeWidth={2.5}
                  dot={snapshots.length <= 31 ? { r: 2.5, fill: color, stroke: "#241b35", strokeWidth: 1.5 } : isolatedTimes.size ? <IsolatedSnapshotDot times={isolatedTimes} /> : false}
                  activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false}>
                  <LabelList dataKey={key} content={({ index, x, y, value }) => index === data.length - 1 && Number.isFinite(Number(x)) && Number.isFinite(Number(y)) ? (
                    <text x={Number(x) + 9} y={Number(y)} fill={color} dominantBaseline="middle" fontSize={12} fontWeight={600}>
                      {number.format(Number(value))}
                    </text>
                  ) : null} />
                </Line>
              </LineChart>
            </ChartContainer>
          </article>
        );
      })}
    </div>
  );
}
