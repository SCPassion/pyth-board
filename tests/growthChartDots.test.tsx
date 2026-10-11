import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { IsolatedSnapshotDot } from "../components/isolated-snapshot-dot";
import { isolatedSnapshotTimes } from "../lib/growth/chartHistory";
import { buildPriceFeedChart } from "../lib/growth/priceFeeds";

function renderHistory(dates: string[]) {
  const snapshots = dates.map((date, index) => ({ date, collectedAt: Date.parse(`${date}T04:15:00Z`), stable: index, comingSoon: 10, inactive: 5 }));
  return renderToStaticMarkup(<LineChart width={600} height={240} data={buildPriceFeedChart(snapshots)}>
    <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} />
    <YAxis />
    <Line dataKey="stable" stroke="#67e8f9" dot={<IsolatedSnapshotDot times={isolatedSnapshotTimes(snapshots)} />} connectNulls={false} isAnimationActive={false} />
  </LineChart>);
}

const dots = (html: string) => (html.match(/<circle class="recharts-line-dot"/g) ?? []).length;

describe("daily history markers", () => {
  it("keeps two observations visible across a missed collection day, including zero", () => {
    expect(dots(renderHistory(["2026-10-11", "2026-10-13"]))).toBe(2);
  });

  it("leaves consecutive history dot-free", () => {
    expect(dots(renderHistory(["2026-10-11", "2026-10-12", "2026-10-13"]))).toBe(0);
  });

  it("marks only the isolated observation between continuous segments", () => {
    expect(dots(renderHistory(["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-08", "2026-10-09"]))).toBe(1);
  });

  it("keeps a single observation visible and empty history blank", () => {
    expect(dots(renderHistory(["2026-10-11"]))).toBe(1);
    expect(dots(renderHistory([]))).toBe(0);
  });

  it("recognizes adjacent UTC dates across month and year boundaries", () => {
    expect(isolatedSnapshotTimes([{ date: "2026-12-31" }, { date: "2027-01-01" }]).size).toBe(0);
  });
});
