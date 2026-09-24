/// <reference types="vite/client" />
import { afterEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import evidence from "./fixtures/routers/wrapper-cycle-evidence.json";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { PARSER_VERSION } from "../lib/tracker/config";
import type { Transaction } from "../lib/tracker/types";
const modules = import.meta.glob("../convex/**/*.ts");
const transaction = () =>
  structuredClone(
    evidence.find((t) => t.signature.startsWith("5Yot"))!,
  ) as unknown as Transaction;
const parse = (tx: Transaction) => parseTransaction(tx, DISCOVERED_PROGRAMS);
const child = (tx: Transaction, n: number) =>
  tx.instructions.find(
    (i) => i.instructionIndex === 1 && i.innerInstructionIndex === n,
  )!;
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it("retains both actual settlements and the host fee without inventing a buy or sell", () => {
  const tx = transaction(),
    before = structuredClone(tx),
    r = parse(tx);
  expect(r.trades).toEqual([]);
  expect(r.orders).toEqual([]);
  expect(r.review).toEqual([]);
  expect(r.arbitrages).toHaveLength(1);
  expect(r.arbitrages![0]).toMatchObject({
    kind: "ARBITRAGE_WITH_HOST_FEE",
    parserVersion: PARSER_VERSION,
    settlements: [
      { debitRaw: "105118386", creditRaw: "106580734", netRaw: "1462348" },
      { debitRaw: "1943481134", creditRaw: "1943520003", netRaw: "38869" },
    ],
    hostFee: { amountRaw: "38869" },
    routeLegs: expect.any(Array),
  });
  expect(r.arbitrages![0].routeLegs).toHaveLength(3);
  expect(tx).toEqual(before);
  tx.success = false;
  expect(parse(tx)).toEqual({ trades: [], orders: [], review: [] });
});
const changes: [string, (t: Transaction) => void][] = [
  [
    "missing fee transfer",
    (t) => {
      t.instructions.splice(t.instructions.indexOf(child(t, 9)), 1);
    },
  ],
  [
    "fee recipient",
    (t) => {
      child(t, 9).accounts.destination_account = "other";
    },
  ],
  [
    "fee authority",
    (t) => {
      child(t, 9).accounts.owner_or_delegate = "other";
    },
  ],
  [
    "fee amount",
    (t) => {
      child(t, 9).args.amount = "1";
    },
  ],
  [
    "fee event",
    (t) => {
      child(t, 11).args.host_fee = "1";
    },
  ],
  [
    "fee decomposition",
    (t) => {
      child(t, 11).args.mm_fee = "1";
    },
  ],
  [
    "unspent input",
    (t) => {
      child(t, 11).args.amount_left = "1";
    },
  ],
  [
    "event program",
    (t) => {
      child(t, 11).programId = "other";
    },
  ],
  [
    "host account",
    (t) => {
      child(t, 6).accounts.host_fee_in = "other";
    },
  ],
  [
    "mint",
    (t) => {
      child(t, 8).accounts.mint = "other";
    },
  ],
  [
    "decimals",
    (t) => {
      child(t, 9).args.decimals = 9;
    },
  ],
  [
    "unknown ancestry",
    (t) => {
      child(t, 9).stackHeight = null;
    },
  ],
  [
    "token extensions",
    (t) => {
      child(t, 9).programId = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
    },
  ],
  [
    "independent intermediary account",
    (t) => {
      child(t, 3).accounts.token_owner_account_a = "other";
    },
  ],
  [
    "extra CPI",
    (t) => {
      t.instructions.splice(t.instructions.indexOf(child(t, 11)) + 1, 0, {
        ...child(t, 9),
        innerInstructionIndex: 12,
      });
    },
  ],
  [
    "unsafe integer",
    (t) => {
      child(t, 9).args.amount = Number.MAX_SAFE_INTEGER + 1;
    },
  ],
];
it.each(changes)("reviews an invalid %s", (_, change) => {
  const t = transaction();
  change(t);
  const r = parse(t);
  expect(r.trades).toEqual([]);
  expect(r.arbitrages).toBeUndefined();
  expect(r.review).toHaveLength(1);
});
async function setup() {
  vi.useFakeTimers();
  vi.stubEnv("HELIUS_API_KEY", "test-key");
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("trackerState", {
      key: "main",
      enabled: true,
      activationTime: 1,
      activationSlot: 1,
      lastWebhookAt: null,
      lastProcessedAt: null,
      lastReconciledAt: null,
      activationEvidence: "test",
    }),
  );
  const tx = transaction(),
    r = parse(tx);
  await t.mutation(internal.trackerStore.enqueue, {
    signatures: [tx.signature],
    source: "WEBHOOK",
  });
  const finish = async (result = r) => {
    const [job] = await t.mutation(internal.trackerStore.claim, {});
    const rawStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["{}"])),
    );
    await t.mutation(internal.trackerStore.finish, {
      id: job.id,
      lease: job.lease,
      ...result,
      parserVersion: PARSER_VERSION,
      rawStorageId,
    });
    return job;
  };
  return { t, tx, r, finish };
}
async function storedRow(t: Awaited<ReturnType<typeof setup>>["t"], signature: string) {
  return t.run((ctx) => ctx.db.query("chainTransactions")
    .withIndex("by_signature", (q) => q.eq("signature", signature)).unique());
}
async function storedArbitrages(t: Awaited<ReturnType<typeof setup>>["t"], signature: string) {
  return (await storedRow(t, signature))?.arbitrages ?? [];
}
it("persists idempotently, retains on review, and clears on a verified empty replay without volume", async () => {
  const { t, tx, r, finish } = await setup();
  for (let i = 0; i < 2; i++) {
    if (i)
      await t.mutation(internal.trackerStore.replay, {
        signature: tx.signature,
      });
    await finish();
    expect(
      await storedArbitrages(t, tx.signature),
    ).toEqual(r.arbitrages);
  }
  await t.mutation(internal.trackerStore.replay, { signature: tx.signature });
  await finish({ trades: [], orders: [], review: ["unsupported new variant"] });
  expect(
    await storedArbitrages(t, tx.signature),
  ).toEqual(r.arbitrages);
  const row = await storedRow(t, tx.signature);
  expect(row).toMatchObject({ status: "PARSE_REVIEW", parserVersion: PARSER_VERSION });
  expect(row?.arbitrages).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("pythTrades").collect())).toEqual([]);
  await t.mutation(internal.trackerStore.replay, { signature: tx.signature });
  await finish({ trades: [], orders: [], review: [] });
  expect(
    await storedArbitrages(t, tx.signature),
  ).toEqual([]);
  await t.run(async (ctx) => {
    expect(await ctx.db.query("pythTrades").first()).toBeNull();
    expect(await ctx.db.query("tradeBuckets").first()).toBeNull();
    expect(await ctx.db.query("tradeOwnerBuckets").first()).toBeNull();
  });
});
it.each([
  "wrong signature",
  "wrong version",
  "duplicate",
  "bad net",
  "bad fee",
])("rejects %s atomically", async (mode) => {
  const { t, tx, r, finish } = await setup();
  const bad = structuredClone(r);
  const a = bad.arbitrages![0];
  if (mode === "wrong signature") a.signature = "other";
  if (mode === "wrong version") a.parserVersion--;
  if (mode === "duplicate") bad.arbitrages!.push(a);
  if (mode === "bad net") a.settlements[0].netRaw = "1";
  if (mode === "bad fee") a.hostFee.amountRaw = "1";
  await expect(finish(bad)).rejects.toThrow();
  expect(
    await storedArbitrages(t, tx.signature),
  ).toEqual([]);
});
// Re-encode the normalized real fixture for transport testing; do not duplicate it.
function payload(tx: Transaction) {
  return {
    signature: tx.signature,
    parserStatus: "OK",
    parsed: {
      slot: tx.slot,
      blockTime: tx.blockTime / 1000,
      transactionStatus: "OK",
      tokenTransfers: Object.entries(tx.decimals).map(([mint, decimals]) => ({
        mint,
        decimals,
      })),
      instructions: tx.instructions.map(({ accounts, args, ...ix }) => ({
        ...ix,
        decoded: {
          args,
          accounts: Object.entries(accounts).map(([name, pubkey]) => ({
            name,
            pubkey,
          })),
        },
      })),
    },
  };
}
it(
  "propagates arbitrage through the worker without valuation or trade totals",
  async () => {
    const { t, tx, r } = await setup();
    const saved = JSON.stringify({
      payload: payload(tx),
      finalizedSuccess: true,
    });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("chainTransactions").first();
      const rawStorageId = await ctx.storage.store(new Blob([saved]));
      await ctx.db.patch(row!._id, { source: "REPROCESS", rawStorageId });
    });
    await t.action(internal.trackerActions.drain, {});
    expect(
      await storedArbitrages(t, tx.signature),
    ).toEqual(r.arbitrages);
    const stored = await storedRow(t, tx.signature);
    expect(stored).toMatchObject({ status: "STORED", parserVersion: PARSER_VERSION });
    expect(stored?.arbitrages).toHaveLength(1);
    expect(stored?.rawStorageId).toBeTruthy();
    expect(await t.run((ctx) => ctx.db.query("pythTrades").collect())).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.query("tradeBuckets").first()),
    ).toBeNull();
  },
);

it('corrects a previously counted trade when the same execution is reclassified, even with another review', async () => {
  const { swapParser } = await import('../lib/tracker/parsers/swap');
  const { t, tx, r, finish } = await setup();
  const old = swapParser(tx, child(tx, 6))!;
  old.tradeId = r.arbitrages![0].executionId;
  await finish({ trades: [old], orders: [], review: [] });
  await t.mutation(internal.trackerStore.replay, { signature: tx.signature });
  await finish({ ...r, review: ['Unrelated execution still needs review'] });
  expect(await storedArbitrages(t, tx.signature)).toEqual(r.arbitrages);
  await t.run(async ctx => {
    expect(await ctx.db.query('pythTrades').first()).toBeNull();
    const bucket = await ctx.db.query('tradeBuckets').first();
    expect(bucket).toMatchObject({ sellRaw: '0', sellCount: 0, buyRaw: '0', buyCount: 0 });
  });
});

it('respects the activation boundary for non-trading settlements', async () => {
  const { t, tx, finish } = await setup();
  await t.run(async ctx => {
    const state = await ctx.db.query('trackerState').first();
    await ctx.db.patch(state!._id, { activationTime: tx.blockTime + 1 });
  });
  await finish();
  expect(await storedArbitrages(t, tx.signature)).toEqual([]);
});
