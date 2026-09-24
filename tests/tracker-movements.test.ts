/// <reference types="vite/client" />
import { afterEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import evidence from "./fixtures/routers/axiom-movement-evidence.json";
import { accountPythMovements } from "../lib/tracker/movements";
import { parseEvidence } from "../lib/tracker/parsers";
import { PARSER_VERSION, PYTH_MINT } from "../lib/tracker/config";
const modules = import.meta.glob("../convex/**/*.ts");
const fixture = () => structuredClone(evidence);
const accounting = (p = fixture()) =>
  accountPythMovements(p, p.signature, true);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it("reconciles raw Axiom PYTH movements independently of an unavailable router decoder", () => {
  const p = fixture(),
    before = structuredClone(p),
    r = accounting(p);
  expect(r.status).toBe("RECONCILED");
  expect(r.transfers.length).toBeGreaterThan(1);
  expect(r.balances.some((b) => b.deltaRaw === "0")).toBe(true);
  const parsed = parseEvidence(
    { ...p, parserStatus: "UNKNOWN" },
    p.signature,
    true,
    [],
  );
  expect(parsed.review).not.toHaveLength(0);
  expect(parsed.trades).toEqual([]);
  expect(parsed.movementAccounting).toEqual(r);
  expect(p).toEqual(before);
});
it("retains explicit partial evidence for missing lifecycle balances without inventing zero", () => {
  const p = fixture();
  const m = p.rawTransaction.meta;
  const i = m.preTokenBalances.findIndex((b) => b.mint === PYTH_MINT);
  m.preTokenBalances.splice(i, 1);
  const r = accounting(p);
  expect(r.status).toBe("PARTIAL");
  expect(r.balances.some((b) => b.preRaw === null && b.deltaRaw === null)).toBe(
    true,
  );
  expect(r.transfers.length).toBeGreaterThan(0);
});
it("detects a transfer/balance mismatch instead of relaxing arithmetic", () => {
  const p = fixture();
  const b = p.rawTransaction.meta.postTokenBalances.find(
    (b) => b.mint === PYTH_MINT,
  )!;
  b.uiTokenAmount.amount = String(BigInt(b.uiTokenAmount.amount) + 1n);
  expect(accounting(p)).toMatchObject({
    status: "PARTIAL",
    issues: expect.arrayContaining([expect.stringContaining("mismatch")]),
  });
});
it.each([
  "signature",
  "slot",
  "duplicate",
  "decimals",
  "program",
  "missing instructions",
  "failed",
  "keys",
])("rejects invalid %s evidence", (mode) => {
  const p = fixture();
  const raw = p.rawTransaction;
  if (mode === "signature") raw.transaction.signatures[0] = "other";
  if (mode === "slot") raw.slot = -1;
  if (mode === "duplicate")
    raw.meta.preTokenBalances.push(raw.meta.preTokenBalances[0]);
  if (mode === "decimals")
    raw.meta.preTokenBalances.find(
      (b) => b.mint === PYTH_MINT,
    )!.uiTokenAmount.decimals = 9;
  if (mode === "program")
    raw.meta.preTokenBalances.find((b) => b.mint === PYTH_MINT)!.programId =
      "other";
  if (mode === "missing instructions")
    (raw.meta as any).innerInstructions = null;
  if (mode === "failed")
    (raw.meta as any).err = { InstructionError: [0, "failed"] };
  if (mode === "keys") raw.transaction.message.accountKeys = [];
  expect(accounting(p)).toMatchObject({
    status: "UNAVAILABLE",
    balances: [],
    transfers: [],
  });
});
it("does not account unsuccessful finalization", () =>
  expect(accountPythMovements(evidence, evidence.signature, false).status).toBe(
    "UNAVAILABLE",
  ));
async function setup() {
  vi.useFakeTimers();
  vi.stubEnv("HELIUS_API_KEY", "test");
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
  await t.mutation(internal.trackerStore.enqueue, {
    signatures: [evidence.signature],
    source: "WEBHOOK",
  });
  return t;
}
async function storedMovement(t: Awaited<ReturnType<typeof setup>>, signature: string) {
  return t.run(async (ctx) => (await ctx.db.query("chainTransactions")
    .withIndex("by_signature", (q) => q.eq("signature", signature)).unique())?.movementAccounting ?? null);
}
it(
  "retains movements on decoder failure without trade totals",
  async () => {
    const t = await setup();
    const saved = JSON.stringify({
      payload: { ...fixture(), parserStatus: "UNKNOWN" },
      finalizedSuccess: true,
    });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("chainTransactions").first();
      await ctx.db.patch(row!._id, {
        source: "REPROCESS",
        rawStorageId: await ctx.storage.store(new Blob([saved])),
      });
    });
    // Retained replay must not need a provider response.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ result: null }), { status: 200 }),
      ),
    );
    await t.action(internal.trackerActions.drain, {});
    vi.unstubAllGlobals();
    expect(
      await storedMovement(t, evidence.signature),
    ).toEqual(accounting());
    await t.run(async (ctx) => {
      const row = await ctx.db.query("chainTransactions").first();
      expect(row?.normalizerVersion).toBe(3);
      expect(row?.classifierVersion).toBe(6);
      expect(await ctx.db.query("pythTrades").first()).toBeNull();
      expect(await ctx.db.query("tradeBuckets").first()).toBeNull();
      expect(await ctx.db.query("tradeOwnerBuckets").first()).toBeNull();
      expect((await ctx.db.query("chainTransactions").first())?.status).toBe(
        "PARSE_REVIEW",
      );
    });
  },
);
it("replays idempotently and preserves evidence across legacy completions", async () => {
  const t = await setup();
  for (const movement of [accounting(), accounting(), undefined]) {
    const [job] = await t.mutation(internal.trackerStore.claim, {});
    const rawStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["{}"])),
    );
    await t.mutation(internal.trackerStore.finish, {
      id: job.id,
      lease: job.lease,
      trades: [],
      orders: [],
      review: ["unknown router"],
      movementAccounting: movement,
      parserVersion: PARSER_VERSION,
      rawStorageId,
    });
    expect(
      await storedMovement(t, evidence.signature),
    ).toEqual(accounting());
    await t.mutation(internal.trackerStore.replay, {
      signature: evidence.signature,
    });
  }
});
it.each(["identity", "version", "delta", "duplicate", "bounds", "reconciled"])(
  "atomically rejects invalid persisted movement %s",
  async (mode) => {
    const t = await setup(),
      m = accounting();
    if (mode === "identity") m.signature = "other";
    if (mode === "version") m.parserVersion--;
    if (mode === "delta") m.balances[0].deltaRaw = "123";
    if (mode === "duplicate") m.transfers.push(m.transfers[0]);
    if (mode === "bounds") m.balances = Array(129).fill(m.balances[0]);
    if (mode === "reconciled") m.issues = ["unresolved"];
    const [job] = await t.mutation(internal.trackerStore.claim, {});
    const rawStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["{}"])),
    );
    await expect(
      t.mutation(internal.trackerStore.finish, {
        id: job.id,
        lease: job.lease,
        trades: [],
        orders: [],
        review: [],
        movementAccounting: m,
        parserVersion: PARSER_VERSION,
        rawStorageId,
      }),
    ).rejects.toThrow();
    expect(
      await storedMovement(t, evidence.signature),
    ).toBeNull();
  },
);
it("does not persist pre-activation movement evidence", async () => {
  const t = await setup();
  await t.run(async (ctx) => {
    const state = await ctx.db.query("trackerState").first();
    await ctx.db.patch(state!._id, {
      activationTime: evidence.rawTransaction.blockTime * 1000 + 1,
    });
  });
  const [job] = await t.mutation(internal.trackerStore.claim, {});
  const rawStorageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["{}"])),
  );
  await t.mutation(internal.trackerStore.finish, {
    id: job.id,
    lease: job.lease,
    trades: [],
    orders: [],
    review: ["unknown"],
    movementAccounting: accounting(),
    parserVersion: PARSER_VERSION,
    rawStorageId,
  });
  expect(
    await storedMovement(t, evidence.signature),
  ).toBeNull();
});
it("preserves prior movement evidence when a later attempt is unavailable", async () => {
  const t = await setup();
  for (const unavailable of [false, true]) {
    const [job] = await t.mutation(internal.trackerStore.claim, {});
    const rawStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["{}"])),
    );
    const movement = accounting();
    if (unavailable) {
      movement.status = "UNAVAILABLE";
      movement.issues = ["Incomplete RPC response"];
      movement.transfers = [];
      movement.balances = [];
    }
    await t.mutation(internal.trackerStore.finish, {
      id: job.id,
      lease: job.lease,
      trades: [],
      orders: [],
      review: ["unknown"],
      movementAccounting: movement,
      parserVersion: PARSER_VERSION,
      rawStorageId,
    });
    expect(
      await storedMovement(t, evidence.signature),
    ).toEqual(accounting());
    await t.mutation(internal.trackerStore.replay, {
      signature: evidence.signature,
    });
  }
});
