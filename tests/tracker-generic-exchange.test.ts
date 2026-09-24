import reviewCorpus from "./fixtures/positions/review-corpus.json";
import cycleRaw from "./fixtures/positions/intermediate-cycle-raw.json";
/// <reference types="vite/client" />
import { expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
import raw from "./fixtures/positions/single-pool-exchange-raw.json";
import { parseEvidence } from "../lib/tracker/parsers";
import { mergeConfirmedExchange } from "../lib/tracker/semantics/pool-exchange";
const signature = raw.transaction.signatures[0];
const parse = (r = structuredClone(raw), success = true) =>
  parseEvidence(
    { signature, rawTransaction: r, parserStatus: "UNAVAILABLE" },
    signature,
    success,
    [],
  );
it("promotes reconciled state with raw swap evidence without enhanced decoding", () => {
  const r = parse();
  expect(r.review).toEqual([]);
  expect(r.trades).toHaveLength(1);
  expect(r.trades[0]).toMatchObject({
    side: "SELL",
    pythAmountRaw: "552200000",
    counterAmountRaw: "309815323",
    router: "STATE_EXCHANGE",
  });
  expect(
    r.stateAnalysis!.economic.domains.some((d) => d.eventType === "SWAP"),
  ).toBe(true);
  // A separate 6,000-lamport native movement does not reduce the WSOL execution proceeds.
  expect(r.stateAnalysis!.nativeSol.domains[0].status).toBe("UNRESOLVED");
});
function wrapped() {
  const r = structuredClone(raw),
    swap = r.transaction.message.instructions[4];
  r.transaction.message.instructions[4] = {
    ...swap,
    programIdIndex: 16,
    data: "",
  };
  const inner = r.meta.innerInstructions.find((g) => g.index === 4)!;
  inner.instructions = [
    { ...swap, stackHeight: 2 },
    ...inner.instructions.map((i) => ({ ...i, stackHeight: 3 })),
  ];
  return r;
}
it("works through an unseen outer program without a router registry entry", () => {
  const r = parse(wrapped());
  expect(r.trades).toHaveLength(1);
  expect(r.trades[0].executionProgramId).toBe(
    raw.transaction.message.accountKeys[16],
  );
  expect(r.trades[0].routeLegs[0].dexName).toBe("Raydium CLMM");
});
it("rejects opposing balances without the verified swap instruction", () => {
  const r = structuredClone(raw);
  r.transaction.message.instructions[4].data = "11111111";
  expect(parse(r).trades).toEqual([]);
});
it("rejects unknown CPI ancestry", () => {
  const r = wrapped();
  r.meta.innerInstructions.find(
    (g) => g.index === 4,
  )!.instructions[1].stackHeight = null as unknown as number;
  expect(parse(r).trades).toEqual([]);
});
it("rejects an account-role mismatch despite matching net deltas", () => {
  const r = structuredClone(raw);
  r.transaction.message.instructions[4].accounts[5] =
    r.transaction.message.instructions[4].accounts[6];
  expect(parse(r).trades).toEqual([]);
});
it("never promotes failed execution or partial token accounting", () => {
  expect(parse(structuredClone(raw), false).trades).toEqual([]);
  const r = structuredClone(raw);
  r.meta.postTokenBalances[0].uiTokenAmount.amount = "1";
  expect(parse(r).trades).toEqual([]);
});
it("does not duplicate existing trades or suppress unrelated review reasons", () => {
  const r = parse(),
    trade = r.trades[0];
  expect(mergeConfirmedExchange(r, [trade]).trades).toHaveLength(1);
  expect(
    mergeConfirmedExchange(
      { trades: [], orders: [], review: ["Unrelated review"] },
      [trade],
    ).review,
  ).toEqual(["Unrelated review"]);
  expect(
    mergeConfirmedExchange(
      {
        trades: [],
        orders: [
          {
            orderKey: "position",
            owner: "owner",
            product: "RECURRING",
            programId: "program",
            sourceSignature: signature,
          },
        ],
        review: [],
      },
      [trade],
    ).trades,
  ).toEqual([]);
});

it.each([
  "drain",
  "drain-cycle",
  "drain-route",
  "drain-genesis",
])("persists confirmed raw exchange/exclusion through %s", async (mode) => {
  const cycle = mode.endsWith("-cycle");
  const route = mode.endsWith("-route"),
    genesis = mode.endsWith("-genesis");
  const fixture =
    route || genesis
      ? reviewCorpus.find((p) =>
          p.signature.startsWith(genesis ? "MxZa" : "58Tvt"),
        )!.rawTransaction
      : cycle
        ? cycleRaw
        : raw;
  const signature = fixture.transaction.signatures[0];
  vi.useFakeTimers();
  vi.stubEnv("HELIUS_API_KEY", "test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 503 })),
  );
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
  const saved = JSON.stringify({
    payload: {
      signature,
      rawTransaction: fixture,
      parserStatus: "UNAVAILABLE",
    },
    finalizedSuccess: true,
  });
  await t.mutation(internal.trackerStore.enqueue, {
    signatures: [signature],
    source: "WEBHOOK",
  });
  await t.run(async (ctx) => {
    const row = await ctx.db.query("chainTransactions").first();
    await ctx.db.patch(row!._id, {
      source: "REPROCESS",
      rawStorageId: await ctx.storage.store(new Blob([saved])),
    });
  });
  await t.action(internal.trackerActions.drain, {});
  await t.run(async (ctx) => {
    const trades = await ctx.db.query("pythTrades").collect();
    expect(trades).toHaveLength(cycle || route ? 0 : 1);
    if (!cycle && !route)
      expect(trades[0]).toMatchObject({
        pythAmountRaw: genesis ? "1571472525" : "552200000",
        router: "STATE_EXCHANGE",
      });
    expect((await ctx.db.query("chainTransactions").first())?.status).not.toBe(
      "PARSE_REVIEW",
    );
  });
});
