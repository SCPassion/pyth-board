import { expect, it, vi, beforeEach } from "vitest";
import { store, latest, history, leaderboard, hasDate } from "../convex/pythGovernanceStakers";
import { collect } from "../convex/pythGovernanceStakerCollection";
import { collectGovernanceStakers } from "../lib/growth/governanceCollector";
import { PublicKey } from "@solana/web3.js";
vi.mock("../lib/growth/governanceCollector", () => ({ collectGovernanceStakers: vi.fn() }));
const handler = (fn: unknown) => (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler;
const args = { stakers: 2, collectedAt: Date.UTC(2026, 8, 12, 15), epoch: "2958", totalStakeAccounts: 4, eligibleStakeAccounts: 3 };
const rankings = { topStakers: [{ owner: "11111111111111111111111111111111", amount: "1000000" }], topUnstaking: [], cooldownSchedule: [] };
const storeArgs = { ...args, ...rankings };
beforeEach(() => vi.clearAllMocks());

it("seeds rankings even when a count snapshot already exists for today", async () => {
  let rankingRow: any = null;
  const db = { query: (table: string) => ({ withIndex: () => ({ unique: async () => table === "pythGovernanceLeaderboard" ? rankingRow : args }) }) };
  expect(await handler(hasDate)({ db }, { date: "2026-09-12" })).toBe(false);
  rankingRow = { topStakers: [{}, {}], topUnstaking: [], collectedAt: args.collectedAt - 86400000 };
  expect(await handler(hasDate)({ db }, { date: "2026-09-12" })).toBe(false);
  rankingRow = { topStakers: [{}, {}], topUnstaking: [], collectedAt: args.collectedAt };
  expect(await handler(hasDate)({ db }, { date: "2026-09-12" })).toBe(false);
  rankingRow.cooldownSchedule = [];
  expect(await handler(hasDate)({ db }, { date: "2026-09-12" })).toBe(true);
  rankingRow.topUnstaking = [{ owner: rankings.topStakers[0].owner, amount: "1" }];
  expect(await handler(hasDate)({ db }, { date: "2026-09-12" })).toBe(false);
});

it("rescans a completed day when its staker ranking still contains only ten owners", async () => {
  const count = { ...args, stakers: 101 };
  const rankingRow = { collectedAt: args.collectedAt, topStakers: Array(10).fill({}), topUnstaking: [], cooldownSchedule: [] };
  const db = { query: (table: string) => ({ withIndex: () => ({ unique: async () => table === "pythGovernanceLeaderboard" ? rankingRow : count }) }) };
  expect(await handler(hasDate)({ db }, { date: "2026-09-12" })).toBe(false);
  rankingRow.topStakers = Array(100).fill({});
  expect(await handler(hasDate)({ db }, { date: "2026-09-12" })).toBe(true);
});

it.each([
  [{ amount: "2", startAt: 6048000000, endAt: 6652800000 }],
  [{ amount: "1", startAt: 6048000000, endAt: 6048000001 }],
  [{ amount: "1", startAt: 6048000001, endAt: 6652800001 }],
  [{ amount: "0", startAt: 6048000000, endAt: 6652800000 }],
  [],
].map(cooldowns => ({ cooldowns })))("rejects incorrect cooldown amounts or dates %#", async ({ cooldowns }) => {
  await expect(handler(store)({}, { ...storeArgs, topUnstaking: [{ owner: rankings.topStakers[0].owner, amount: "1", cooldowns }] })).rejects.toThrow("Invalid governance cooldowns");
});

it.each([
  [{ amount: "1", owners: 1, endAt: 6048000001 }],
  [{ amount: "0", owners: 1, endAt: 6048000000 }],
  [{ amount: "1", owners: 0, endAt: 6048000000 }],
  [{ amount: "1", owners: 5, endAt: 6048000000 }],
  [{ amount: "1", owners: 1, endAt: 6048000000 }, { amount: "1", owners: 1, endAt: 6048000000 }],
].map(cooldownSchedule => ({ cooldownSchedule })))("rejects invalid full cooldown schedules %#", async ({ cooldownSchedule }) => {
  await expect(handler(store)({}, { ...storeArgs, cooldownSchedule })).rejects.toThrow("Invalid governance cooldown schedule");
});

it("replaces only the latest leaderboard and never lets an older scan overwrite it", async () => {
  let row: any = null;
  const db = {
    query: (table: string) => ({ withIndex: () => ({ unique: async () => table === "pythGovernanceLeaderboard" ? row : { ...args } }) }),
    insert: vi.fn(async (_table, value) => { row = { ...value, _id: "ranking" }; }),
    replace: vi.fn(async (_id, value) => { row = { ...value, _id: "ranking" }; }),
  };
  await handler(store)({ db }, storeArgs);
  await handler(store)({ db }, { ...storeArgs, collectedAt: args.collectedAt + 1000 });
  await handler(store)({ db }, storeArgs);
  expect(db.insert).toHaveBeenCalledTimes(1);
  expect(db.replace).toHaveBeenCalledTimes(1);
  expect(await handler(leaderboard)({ db }, {})).toEqual({ ...rankings, epoch: args.epoch, collectedAt: args.collectedAt + 1000 });
});

it.each([
  [{ owner: "invalid", amount: "1" }],
  [{ owner: rankings.topStakers[0].owner, amount: "0" }],
  Array.from({ length: 101 }, (_, i) => ({ owner: new PublicKey(Buffer.alloc(32, i + 1)).toBase58(), amount: "1" })),
  [rankings.topStakers[0], rankings.topStakers[0]],
  [{ ...rankings.topStakers[0], amount: "1" }, { owner: "11111111111111111111111111111112", amount: "2" }],
].map(topStakers => ({ topStakers })))("rejects malformed or unbounded rankings %# before reading the database", async ({ topStakers }) => {
  await expect(handler(store)({}, { ...storeArgs, topStakers })).rejects.toThrow("Invalid governance leaderboard");
});

it("keeps the first successful daily snapshot through an indexed transaction", async () => {
  const rows: any[] = [];
  let rankingRow: any = null;
  const withIndex = vi.fn((_name, filter) => { filter({ eq: (key: string, date: string) => { expect(key).toBe("date"); expect(date).toBe("2026-09-12"); } }); return { unique: async () => rows[0] ?? null }; });
  const db = { query: vi.fn(table => table === "pythGovernanceLeaderboard" ? { withIndex: () => ({ unique: async () => rankingRow }) } : { withIndex }), insert: vi.fn(async (table, row) => { if (table === "pythGovernanceLeaderboard") rankingRow = row; else rows.push(row); }) };
  await handler(store)({ db }, storeArgs);
  await handler(store)({ db }, { ...storeArgs, stakers: 3 });
  expect(db.query).toHaveBeenCalledWith("pythGovernanceStakerSnapshots");
  expect(withIndex).toHaveBeenCalledWith("by_date", expect.any(Function));
  expect(rows).toEqual([{ ...args, date: "2026-09-12" }]);
});

it.each([{ stakers: 0 }, { stakers: NaN }, { eligibleStakeAccounts: 1 }, { totalStakeAccounts: 1 }, { collectedAt: 0 }, { epoch: "bad" }])("rejects invalid snapshots before DB access", async invalid => {
  await expect(handler(store)({}, { ...storeArgs, ...invalid })).rejects.toThrow("Invalid");
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
  const result = { ...storeArgs, collectedAt: Date.now(), pages: 1, requests: 3, responseBytes: 100, startedAt: Date.now(), encoding: "base64" as const, pageSize: 1000 };
  vi.mocked(collectGovernanceStakers).mockResolvedValue(result);
  await handler(collect)(ctx, {});
  expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), { ...storeArgs, collectedAt: result.collectedAt });
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
  let rankingRow: any = null;
  const db = { query: (table: string) => ({ withIndex: () => ({ unique: async () => table === "pythGovernanceLeaderboard" ? rankingRow : rows[0] ?? null }) }),
    insert: async (table: string, row: unknown) => { if (table === "pythGovernanceLeaderboard") rankingRow = row; else rows.push(row); } };
  // Convex serializes conflicting indexed transactions via OCC. Model that boundary
  // here; deployment verification also invokes the real mutation concurrently.
  let transaction = Promise.resolve();
  const ctx = { runQuery: vi.fn().mockResolvedValue(false), runMutation: vi.fn((_ref, input) => {
    transaction = transaction.then(() => handler(store)({ db }, input)); return transaction;
  }) };
  vi.mocked(collectGovernanceStakers).mockResolvedValue({ ...storeArgs, collectedAt: Date.now(), startedAt: Date.now(),
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
