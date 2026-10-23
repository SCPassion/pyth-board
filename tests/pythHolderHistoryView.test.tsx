import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { PythHolderBubbles } from "../components/pyth-holder-bubbles";
import { PythHolderHistoryChart } from "../components/pyth-holder-history";
import type { HolderHistory } from "../lib/growth/holderHistory";

const query = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useQuery: query }));
const a = "1".repeat(32), b = "2".repeat(32);
const history: HolderHistory = {
  owner: a, days: 7, date: "2026-10-04", collectedAt: Date.parse("2026-10-04T03:01:00Z"),
  points: [
    { date: "2026-10-03", amount: null, collectedAt: null },
    { date: "2026-10-04", amount: "9007199254740993", collectedAt: Date.parse("2026-10-04T03:01:00Z") },
  ],
};
const entries = [a, b].map((owner, index) => ({
  owner, amount: "9007199254740993", viewRank: index + 1,
  changes: [{ days: 1, amountDelta: "1", percentageDelta: "0.00" }, { days: 7, amountDelta: "7000000", percentageDelta: "0.01" }],
}));

beforeEach(() => { query.mockReset(); query.mockReturnValue(history); });

describe("wallet selection and holdings history", () => {
  it("fetches history only while a visible wallet is selected and uses the selected owner and period", () => {
    const render = (owner: string | null, days: 1 | 7 = 7) => renderToStaticMarkup(
      <PythHolderBubbles entries={entries} selectedOwner={owner} days={days} ready onSelectOwner={() => {}} />,
    );
    expect(render(null)).not.toContain("PYTH holdings over time");
    expect(query).not.toHaveBeenCalled();
    expect(render(a)).toContain("PYTH holdings over time");
    expect(getFunctionName(query.mock.calls[0][0])).toBe("pythHolderRankings:history");
    expect(query.mock.calls[0][1]).toEqual({ owner: a, days: 7 });
    render(b, 1);
    expect(query.mock.calls.at(-1)![1]).toEqual({ owner: b, days: 1 });
    query.mockClear();
    expect(render("3".repeat(32))).not.toContain("PYTH holdings over time");
    expect(query).not.toHaveBeenCalled();
  });

  it("shows exact balances, UTC collection time, and unknown days in an accessible table", () => {
    const html = renderToStaticMarkup(<PythHolderHistoryChart history={history} days={7} />);
    expect(html).toContain("9,007,199,254.740993");
    expect(html).toContain("2026-10-03");
    expect(html).toContain("Unavailable");
    expect(html).toContain("4 Oct 2026, 03:01");
    expect(html).toContain("View recorded balances");
    expect(html).toContain("Only one snapshot is available");
    expect(html).toContain("appear as gaps");
  });

  it("keeps loading and unavailable history explicit", () => {
    expect(renderToStaticMarkup(<PythHolderHistoryChart history={undefined} days={1} />)).toContain("Loading wallet history");
    const empty = renderToStaticMarkup(<PythHolderHistoryChart history={null} days={30} />);
    expect(empty).toContain("30 days");
    expect(empty).toContain("No recorded balances");
    expect(empty).not.toContain("View recorded balances");
    const unknown = { ...history, points: history.points.map(point => ({ ...point, amount: null })) };
    expect(renderToStaticMarkup(<PythHolderHistoryChart history={unknown} days={7} />)).toContain("No recorded balances");
  });
});
