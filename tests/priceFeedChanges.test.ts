import { describe, expect, it } from "vitest";
import { buildPriceFeedChart, buildPriceFeedChangeChart, priceFeedChangeDomain, priceFeedVisibleScale, type PriceFeedSnapshot } from "../lib/growth/priceFeeds";

const snapshots: PriceFeedSnapshot[] = [
  { date: "2026-10-11", collectedAt: Date.UTC(2026, 9, 11), stable: 1883, comingSoon: 1193, inactive: 777 },
  { date: "2026-10-12", collectedAt: Date.UTC(2026, 9, 12), stable: 1885, comingSoon: 1192, inactive: 777 },
  { date: "2026-10-18", collectedAt: Date.UTC(2026, 9, 18), stable: 1911, comingSoon: 1176, inactive: 778 },
];

describe("price-feed change history", () => {
  it("compares statuses on a common zero baseline and retains actual counts for tooltips", () => {
    const chart = buildPriceFeedChangeChart(snapshots);
    expect(chart[0]).toMatchObject({ stable: 0, comingSoon: 0, inactive: 0, total: 0 });
    expect(chart.at(-1)).toMatchObject({
      stable: 28, comingSoon: -17, inactive: 1, total: 12,
      counts: { stable: 1911, comingSoon: 1176, inactive: 778, total: 3865 },
    });
    expect(snapshots[0].stable).toBe(1883);
  });

  it("keeps missed collection days blank instead of inventing a change", () => {
    const gap = buildPriceFeedChangeChart(snapshots)[2];
    expect(gap).toEqual({
      time: Date.UTC(2026, 9, 17), stable: null, comingSoon: null, inactive: null, total: null,
      counts: { stable: null, comingSoon: null, inactive: null, total: null },
    });
  });

  it("resets the baseline to the first observation in the selected period", () => {
    expect(buildPriceFeedChangeChart(snapshots.slice(1)).at(-1)).toMatchObject({
      stable: 26, comingSoon: -16, inactive: 1, total: 11,
    });
  });

  it("handles single snapshots, genuine zero counts, and empty history", () => {
    expect(buildPriceFeedChangeChart([])).toEqual([]);
    expect(buildPriceFeedChangeChart(snapshots.slice(0, 1))[0]).toMatchObject({ stable: 0, comingSoon: 0, inactive: 0 });
    const chart = buildPriceFeedChangeChart(snapshots.map(row => ({ ...row, inactive: 0 })));
    expect(chart.at(-1)).toMatchObject({ inactive: 0, counts: { inactive: 0 } });
  });
});

describe("price-feed change scale", () => {
  it.each([[-17, 28], [-100, -5], [0, 50], [0, 0]])("includes the visible extent and zero baseline with padding for [%s, %s]", (min, max) => {
    const [lower, upper] = priceFeedChangeDomain([min, max]);
    expect(lower).toBeLessThan(min);
    expect(upper).toBeGreaterThan(max);
    expect(lower).toBeLessThan(0);
    expect(upper).toBeGreaterThan(0);
  });

  it("uses the available height for a line with only gains or only losses", () => {
    const [gainMin, gainMax] = priceFeedChangeDomain([0, 50]);
    const [lossMin, lossMax] = priceFeedChangeDomain([-50, 0]);
    expect(gainMax).toBeGreaterThan(Math.abs(gainMin) * 2);
    expect(Math.abs(lossMin)).toBeGreaterThan(lossMax * 2);
  });
});

describe("visible price-feed scale", () => {
  it.each(["change", "counts"] as const)("ignores hidden lines and missing days in %s view", view => {
    const chart = view === "change" ? buildPriceFeedChangeChart(snapshots) : buildPriceFeedChart(snapshots);
    const [allMin, allMax] = priceFeedVisibleScale(chart, ["stable", "comingSoon", "inactive"], view).domain;
    const { domain: [min, max], ticks } = priceFeedVisibleScale(chart, ["inactive"], view);
    expect(max - min).toBeLessThan((allMax - allMin) / 5);
    expect(min).toBeLessThan(view === "change" ? 0 : 777);
    expect(max).toBeGreaterThan(view === "change" ? 1 : 778);
    expect(priceFeedVisibleScale(chart.filter(point => point.inactive !== null), ["inactive"], view).domain).toEqual([min, max]);
    expect(ticks.every(Number.isInteger)).toBe(true);
    if (view === "change") expect(ticks).toContain(0);
  });

  it("fits all visible count lines without forcing a zero origin", () => {
    const [min, max] = priceFeedVisibleScale(buildPriceFeedChart(snapshots), ["stable", "comingSoon"], "counts").domain;
    expect(min).toBeGreaterThan(0);
    expect(min).toBeLessThan(1176);
    expect(max).toBeGreaterThan(1911);
  });

  it.each(["change", "counts"] as const)("includes the total line and zooms to total alone in %s view", view => {
    const chart = view === "change" ? buildPriceFeedChangeChart(snapshots) : buildPriceFeedChart(snapshots);
    const { domain: [min, max] } = priceFeedVisibleScale(chart, ["stable", "comingSoon", "inactive", "total"], view);
    const { domain: [totalMin, totalMax] } = priceFeedVisibleScale(chart, ["total"], view);
    const totalValues = chart.flatMap(point => point.total === null ? [] : [point.total]);
    expect(min).toBeLessThan(Math.min(...totalValues));
    expect(max).toBeGreaterThan(Math.max(...totalValues));
    expect(totalMin).toBeLessThan(Math.min(...totalValues));
    expect(totalMax).toBeGreaterThan(Math.max(...totalValues));
    expect(totalMax - totalMin).toBeLessThan(max - min);
  });

  it("handles empty selections and missing history without invalid bounds", () => {
    expect(priceFeedVisibleScale(buildPriceFeedChart(snapshots), [], "counts").domain).toEqual([0, 1]);
    expect(priceFeedVisibleScale([], ["stable"], "change").domain).toEqual([-1, 1]);
  });
});
