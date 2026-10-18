import { expect, it } from "vitest";
import { changedHolders, orderHolderMovers } from "../lib/growth/holderMovers";
import { layoutHolderBubbles } from "../lib/growth/holderBubbles";

it("ranks signed token changes exactly beyond Number precision, with stable ties", () => {
  const rows = [
    { rank: 1, changes: [{ days: 1, amountDelta: "9007199254740992" }, { days: 7, amountDelta: "-9" }] },
    { rank: 2, changes: [{ days: 1, amountDelta: "9007199254740993" }, { days: 7, amountDelta: "-10" }] },
    { rank: 3, changes: [{ days: 1, amountDelta: "1" }, { days: 7, amountDelta: "-10" }] },
    { rank: 4, changes: [{ days: 1, amountDelta: "0" }] },
    { rank: 5, changes: [{ days: 1, amountDelta: null }] },
  ];
  expect(orderHolderMovers(rows, 1, "increase", true).map(row => row.rank)).toEqual([2, 1, 3]);
  expect(orderHolderMovers(rows, 7, "reduction", true).map(row => row.rank)).toEqual([2, 3, 1]);
  expect(orderHolderMovers(rows, 1, "reduction", true)).toEqual([]);
  expect(orderHolderMovers(rows, 1, "increase", false)).toEqual([]);
  expect(orderHolderMovers(rows, 30, "increase", true)).toEqual([]);
  expect(orderHolderMovers(rows, 1, "balance", false)).toBe(rows);
  expect(changedHolders(rows, 1, true).map(row=>row.rank)).toEqual([1,2,3]);
  expect(changedHolders(rows, 7, true).map(row=>row.rank)).toEqual([1,2,3]);
  expect(changedHolders(rows, 1, false)).toEqual([]);
  expect(changedHolders(rows, 30, true)).toEqual([]);
  expect(rows.map(row => row.rank)).toEqual([1, 2, 3, 4, 5]);
});

it.each([280, 375, 640, 1100])("packs 100 wallets at width %i without overlap or clipping", width => {
  const height = width < 640 ? 560 : 500;
  for (const distribution of ["equal", "skewed", "zero"]) {
    const entries = Array.from({ length: 100 }, (_, i) => ({ owner: `wallet${i}`, weight: distribution === "equal" ? 1n : distribution === "zero" ? 0n : i === 0 ? 10n ** 20n : BigInt(100 - i) }));
    const points = layoutHolderBubbles(entries, width, height);
    expect(points).toHaveLength(100);
    expect(new Set(points.map(point => point.owner)).size).toBe(100);
    for (const [index, point] of points.entries()) {
      expect(point.radius).toBeGreaterThanOrEqual(12);
      expect(point.x - point.radius).toBeGreaterThanOrEqual(0);
      expect(point.x + point.radius).toBeLessThanOrEqual(width);
      expect(point.y - point.radius).toBeGreaterThanOrEqual(0);
      expect(point.y + point.radius).toBeLessThanOrEqual(height);
      for (const other of points.slice(index + 1)) {
        expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThanOrEqual(point.radius + other.radius + 3.99);
      }
    }
  }
});

it("keeps bubble positions deterministic and handles empty and single-owner snapshots", () => {
  expect(layoutHolderBubbles([], 1000, 500)).toEqual([]);
  const entries = [{ owner: "one", weight: 5n }];
  expect(layoutHolderBubbles(entries, 375, 560)).toEqual(layoutHolderBubbles(entries, 375, 560));
  expect(layoutHolderBubbles(entries, 375, 560)[0]).toMatchObject({ owner: "one", x: 187.5, y: 280 });
});

it.each([800,1200,1600])("distributes a sparse, skewed starting layout across width %i", width => {
  const entries=Array.from({length:30},(_,i)=>({owner:`wallet${i}`,weight:i===0?10n**16n:BigInt(30-i)*10n**12n}));
  const points=layoutHolderBubbles(entries,width,500);
  expect(points).toHaveLength(30);
  const left=Math.min(...points.map(point=>point.x-point.radius));
  const right=Math.max(...points.map(point=>point.x+point.radius));
  expect(left).toBeGreaterThanOrEqual(0);
  expect(right).toBeLessThanOrEqual(width);
  expect(left).toBeLessThan(width*0.15);
  expect(right).toBeGreaterThan(width*0.85);
  for(const [i,point] of points.entries()) for(const other of points.slice(i+1)) {
    expect(Math.hypot(point.x-other.x,point.y-other.y)).toBeGreaterThanOrEqual(point.radius+other.radius+3.99);
  }
});
