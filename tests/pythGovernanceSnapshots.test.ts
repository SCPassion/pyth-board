import { expect, it, vi, beforeEach } from "vitest";
import { store, latest, history } from "../convex/pythGovernanceStakers";
import { collect } from "../convex/pythGovernanceStakerCollection";
import { collectGovernanceStakers } from "../lib/growth/governanceCollector";
vi.mock("../lib/growth/governanceCollector", () => ({ collectGovernanceStakers: vi.fn() }));
const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
const args = { stakers: 2, collectedAt: Date.UTC(2026, 8, 12, 15), epoch: "2958", totalStakeAccounts: 4, eligibleStakeAccounts: 3 };
beforeEach(() => vi.clearAllMocks());

it("keeps the first successful daily snapshot through an indexed transaction", async () => {
  const rows: any[] = [];
  const withIndex = vi.fn((_name, filter) => { filter({ eq: (key: string, date: string) => { expect(key).toBe("date"); expect(date).toBe("2026-09-12"); } }); return { unique: async () => rows[0] ?? null }; });
  const db = { query: vi.fn(() => ({ withIndex })), insert: vi.fn(async (_table, row) => { rows.push(row); }) };
  await handler(store)({ db }, args);
  await handler(store)({ db }, { ...args, stakers: 3 });
  expect(db.query).toHaveBeenCalledWith("pythGovernanceStakerSnapshots");
  expect(withIndex).toHaveBeenCalledWith("by_date", expect.any(Function));
  expect(rows).toEqual([{ ...args, date: "2026-09-12" }]);
});

it.each([{ stakers: 0 }, { stakers: NaN }, { eligibleStakeAccounts: 1 }, { totalStakeAccounts: 1 }, { collectedAt: 0 }, { epoch: "bad" }])("rejects invalid snapshots before DB access", async invalid => {
  await expect(handler(store)({}, { ...args, ...invalid })).rejects.toThrow("Invalid");
});

it("skips an existing day without RPC or writes", async () => {
  const ctx = { runQuery: vi.fn().mockResolvedValue(true), runMutation: vi.fn() };
  await handler(collect)(ctx, {});
  expect(collectGovernanceStakers).not.toHaveBeenCalled(); expect(ctx.runMutation).not.toHaveBeenCalled();
});

it("never writes when collection fails", async () => {
  const ctx = { runQuery: vi.fn().mockResolvedValue(false), runMutation: vi.fn() };
  vi.mocked(collectGovernanceStakers).mockRejectedValue(Error("incomplete"));
  await expect(handler(collect)(ctx, {})).rejects.toThrow("incomplete");
  expect(ctx.runMutation).not.toHaveBeenCalled();
});

it("stores only a complete same-day scan and rejects midnight", async () => {
  const ctx = { runQuery: vi.fn().mockResolvedValue(false), runMutation: vi.fn() };
  const result = { ...args, collectedAt: Date.now(), pages: 1, requests: 3, responseBytes: 100, startedAt: Date.now(), encoding: "base64" as const, pageSize: 1000 };
  vi.mocked(collectGovernanceStakers).mockResolvedValue(result);
  await handler(collect)(ctx, {});
  expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), { ...args, collectedAt: result.collectedAt });
  ctx.runMutation.mockClear();
  vi.mocked(collectGovernanceStakers).mockResolvedValue({ ...result, collectedAt: Date.now() + 86400000 });
  await expect(handler(collect)(ctx, {})).rejects.toThrow("midnight");
  expect(ctx.runMutation).not.toHaveBeenCalled();
});

it("returns only public snapshot fields and preserves history pagination", async () => {
  const row = { ...args, date: "2026-09-12", _id: "private" };
  const paginate = vi.fn().mockResolvedValue({ page: [row], isDone: false, continueCursor: "next" });
  const order = vi.fn(() => ({ first: async () => row, paginate }));
  const db = { query: () => ({ withIndex: () => ({ order }) }) };
  expect(await handler(latest)({ db }, {})).toEqual({ date: row.date, stakers: row.stakers, collectedAt: row.collectedAt });
  const opts = { numItems: 1, cursor: null };
  expect(await handler(history)({ db }, { since: row.date, paginationOpts: opts })).toEqual({ page: [{ date: row.date, stakers: row.stakers, collectedAt: row.collectedAt }], isDone: false, continueCursor: "next" });
  expect(paginate).toHaveBeenCalledWith(opts);
});

it("concurrent daily actions preserve one canonical row under Convex transaction serialization", async () => {
  const rows: any[] = [];
  const db = { query: () => ({ withIndex: () => ({ unique: async () => rows[0] ?? null }) }),
    insert: async (_table: string, row: unknown) => { rows.push(row); } };
  // Convex serializes conflicting indexed transactions via OCC. Model that boundary
  // here; deployment verification also invokes the real mutation concurrently.
  let transaction = Promise.resolve();
  const ctx = { runQuery: vi.fn().mockResolvedValue(false), runMutation: vi.fn((_ref, input) => {
    transaction = transaction.then(() => handler(store)({ db }, input)); return transaction;
  }) };
  vi.mocked(collectGovernanceStakers).mockResolvedValue({ ...args, collectedAt: Date.now(), startedAt: Date.now(),
    encoding: "base64", pageSize: 1000, pages: 1, requests: 3, responseBytes: 100 });
  await Promise.all([handler(collect)(ctx, {}), handler(collect)(ctx, {})]);
  expect(ctx.runMutation).toHaveBeenCalledTimes(2); expect(rows).toHaveLength(1);
});

import crons from "../convex/crons";
it("separates holder collection at 03:00 UTC from stakers at 15:00 UTC", () => {
  const jobs = JSON.parse((crons as unknown as { export: () => string }).export());
  expect(jobs["collect native PYTH holders"].schedule).toMatchObject({ hourUTC: 3, minuteUTC: 0 });
  expect(jobs["collect PYTH governance stakers"].schedule).toMatchObject({ hourUTC: 15, minuteUTC: 0 });
});
