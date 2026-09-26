/// <reference types="vite/client" />
import { afterEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import corpus from "./fixtures/positions/review-corpus.json";
import normalBuy from "./fixtures/jupiter/normal-buy.json";
import normalSell from "./fixtures/jupiter/normal-sell.json";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { PARSED_BATCH_SIZE } from "../convex/heliusClient";

const modules = import.meta.glob("../convex/**/*.ts");
const tradeEvidence = corpus.find((p) => p.signature.startsWith("5hL7"))!;
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function setup() {
  vi.useFakeTimers();
  vi.stubEnv("HELIUS_API_KEY", "test-key");
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("trackerState", {
      key: "main", enabled: true, activationTime: 1, activationSlot: 1,
      lastWebhookAt: null, lastProcessedAt: null, lastReconciledAt: null,
      activationEvidence: "isolated fault injection",
    }),
  );
  return t;
}

it.each([false, true])("batches independent decodes and preserves per-signature fallback (batch fails: %s)", async (batchFails) => {
  const t = await setup();
  const fixtures = [normalBuy, normalSell];
  await t.run(async (ctx) => {
    for (const program of DISCOVERED_PROGRAMS)
      await ctx.db.insert("jupiterPrograms", { ...program, source: "batch regression", updatedAt: Date.now() });
  });
  await t.mutation(internal.trackerStore.enqueue, {
    signatures: fixtures.map((fixture) => fixture.signature), source: "WEBHOOK",
  });
  const parseRequests: string[][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (url.includes("parsed-events")) {
      parseRequests.push(body.transactions);
      if (batchFails && body.transactions.length > 1)
        return Response.json({ malformed: true });
      return Response.json(body.transactions.map((signature: string) => {
        const fixture = fixtures.find((item) => item.signature === signature);
        if (!fixture) throw new Error("Unexpected signature");
        return fixture;
      }).reverse());
    }
    const signature = body.params[0] as string;
    if (body.method === "getSignatureStatuses")
      throw new Error("The finalized raw transaction makes a status RPC redundant");
    if (body.method === "getTransaction")
      return Response.json({ result: {
        slot: 1, blockTime: 1, transaction: { signatures: [signature], message: { accountKeys: [], instructions: [] } },
        meta: { err: null, preTokenBalances: [], postTokenBalances: [], innerInstructions: [] },
      } });
    throw new Error(`Unexpected RPC ${body.method}`);
  }));
  await t.action(internal.trackerActions.drain, {});
  const rows = await t.run((ctx) => ctx.db.query("chainTransactions").take(3));
  expect(rows).toHaveLength(2);
  expect(rows.every((row) => row.status !== "RETRY" && row.status !== "FAILED")).toBe(true);
  expect(await t.run((ctx) => ctx.db.query("pythTrades").take(3))).toHaveLength(2);
  expect(parseRequests).toEqual(batchFails
    ? [[normalBuy.signature, normalSell.signature], [normalBuy.signature], [normalSell.signature]]
    : [[normalBuy.signature, normalSell.signature]]);
});

it("keeps a full batch in one Parsed Events request", async () => {
  const t = await setup();
  for (const program of DISCOVERED_PROGRAMS)
    await t.run((ctx) => ctx.db.insert("jupiterPrograms", { ...program, source: "batch regression", updatedAt: Date.now() }));
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const signatures = [...alphabet].slice(0, PARSED_BATCH_SIZE).map((character) => character + normalBuy.signature.slice(1));
  await t.mutation(internal.trackerStore.enqueue, { signatures, source: "WEBHOOK" });
  const parseRequests: string[][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (url.includes("parsed-events")) {
      parseRequests.push(body.transactions);
      return Response.json(body.transactions.map((signature: string) => ({ ...normalBuy, signature })));
    }
    if (body.method === "getSignatureStatuses")
      return Response.json({ result: { value: [{ confirmationStatus: "finalized", err: null }] } });
    if (body.method === "getTransaction") return Response.json({ result: {
      slot: 1, blockTime: 1, transaction: { signatures: [body.params[0]], message: { accountKeys: [], instructions: [] } },
      meta: { err: null, preTokenBalances: [], postTokenBalances: [], innerInstructions: [] },
    } });
    return new Response("", { status: 503 });
  }));
  await t.action(internal.trackerActions.drain, {});
  expect(parseRequests).toEqual([signatures]);
  expect(await t.run((ctx) => ctx.db.query("pythTrades").take(PARSED_BATCH_SIZE + 1))).toHaveLength(PARSED_BATCH_SIZE);
});

it("caps paid fallback requests when every parsed batch is malformed", async () => {
  const t = await setup();
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const signatures = [...alphabet].slice(0, PARSED_BATCH_SIZE).map((character) => character + normalBuy.signature.slice(1));
  await t.mutation(internal.trackerStore.enqueue, { signatures, source: "WEBHOOK" });
  let parsedRequests = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("parsed-events")) {
      parsedRequests++;
      return Response.json({ malformed: true });
    }
    const body = JSON.parse(String(init?.body));
    if (body.method === "getTransaction") return Response.json({ result: {
      slot: 1, blockTime: 1,
      transaction: { signatures: [body.params[0]], message: { accountKeys: [], instructions: [] } },
      meta: { err: null, preTokenBalances: [], postTokenBalances: [], innerInstructions: [] },
    } });
    throw new Error(`Unexpected RPC ${body.method}`);
  }));
  await t.action(internal.trackerActions.drain, {});
  expect(parsedRequests).toBe(8);
  const rows = await t.run((ctx) => ctx.db.query("chainTransactions").take(PARSED_BATCH_SIZE + 1));
  expect(rows).toHaveLength(PARSED_BATCH_SIZE);
  expect(rows.every((row) => row.status === "PARSE_REVIEW")).toBe(true);
});

it("batches signatures again after a shared transient retry", async () => {
  const t = await setup();
  const fixtures = [normalBuy, normalSell];
  for (const program of DISCOVERED_PROGRAMS)
    await t.run((ctx) => ctx.db.insert("jupiterPrograms", { ...program, source: "retry regression", updatedAt: Date.now() }));
  await t.mutation(internal.trackerStore.enqueue, {
    signatures: fixtures.map((fixture) => fixture.signature), source: "WEBHOOK",
  });
  const initial = await t.run((ctx) => ctx.db.query("trackerState").first());
  await t.mutation(internal.trackerStore.startScheduledDrain, { token: initial!.drainToken! });
  let unavailable = true;
  const parseRequests: string[][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (unavailable) return new Response("", { status: 503 });
    const body = JSON.parse(String(init?.body));
    if (url.includes("parsed-events")) {
      parseRequests.push(body.transactions);
      return Response.json(body.transactions.map((signature: string) => fixtures.find((fixture) => fixture.signature === signature)));
    }
    if (body.method === "getSignatureStatuses")
      return Response.json({ result: { value: [{ confirmationStatus: "finalized", err: null }] } });
    if (body.method === "getTransaction") return Response.json({ result: {
      slot: 1, blockTime: 1, transaction: { signatures: [body.params[0]], message: { accountKeys: [], instructions: [] } },
      meta: { err: null, preTokenBalances: [], postTokenBalances: [], innerInstructions: [] },
    } });
    throw new Error(`Unexpected RPC ${body.method}`);
  }));
  await t.action(internal.trackerActions.drain, {});
  const rows = await t.run((ctx) => ctx.db.query("chainTransactions").take(3));
  expect(rows.every((row) => row.status === "RETRY")).toBe(true);
  vi.setSystemTime(rows[0].nextAttemptAt);
  for (const row of rows)
    await t.mutation(internal.trackerStore.wakeRetry, { id: row._id, nextAttemptAt: row.nextAttemptAt });
  const scheduled = await t.run((ctx) => ctx.db.query("trackerState").first());
  vi.setSystemTime(scheduled!.drainDueAt!);
  await t.mutation(internal.trackerStore.startScheduledDrain, { token: scheduled!.drainToken! });
  unavailable = false;
  await t.action(internal.trackerActions.drain, {});
  expect(parseRequests).toEqual([fixtures.map((fixture) => fixture.signature)]);
  expect(await t.run((ctx) => ctx.db.query("pythTrades").take(3))).toHaveLength(2);
});

it("does not fan out paid requests during a transient batch outage", async () => {
  const t = await setup();
  const signatures = [normalBuy.signature, normalSell.signature];
  await t.mutation(internal.trackerStore.enqueue, { signatures, source: "WEBHOOK" });
  const parseRequests: string[][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (url.includes("parsed-events")) {
      parseRequests.push(body.transactions);
      return new Response("", { status: 503 });
    }
    if (body.method === "getSignatureStatuses")
      return Response.json({ result: { value: [{ confirmationStatus: "finalized", err: null }] } });
    if (body.method === "getTransaction") return Response.json({ result: {
      slot: 1, blockTime: 1, transaction: { signatures: [body.params[0]], message: { accountKeys: [], instructions: [] } },
      meta: { err: null, preTokenBalances: [], postTokenBalances: [], innerInstructions: [] },
    } });
    throw new Error(`Unexpected RPC ${body.method}`);
  }));
  await t.action(internal.trackerActions.drain, {});
  expect(parseRequests).toEqual([signatures]);
  expect((await t.run((ctx) => ctx.db.query("chainTransactions").take(3))).every((row) => row.status === "PARSE_REVIEW")).toBe(true);
});

it("recovers after repeated provider outages without duplicate trades or volume", async () => {
  const t = await setup();
  const signature = tradeEvidence.signature;
  expect(await t.mutation(internal.trackerStore.enqueue, {
    signatures: [signature, signature], source: "WEBHOOK",
  })).toBe(1);
  let failure: "throttle" | "outage" | "malformed" | null = "throttle";
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (failure === "throttle") return new Response("", { status: 429 });
    if (failure === "outage") return new Response("", { status: 503 });
    if (failure === "malformed") return new Response("truncated");
    if (!url.includes("mainnet.helius-rpc.com"))
      return new Response("", { status: 503 });
    if (url.includes("parsed-events")) return new Response("", { status: 503 });
    const method = JSON.parse(String(init?.body)).method;
    if (method === "getSignatureStatuses")
      return Response.json({ result: { value: [{ confirmationStatus: "finalized", err: null }] } });
    if (method === "getTransaction")
      return Response.json({ result: tradeEvidence.rawTransaction });
    throw Error(`Unexpected RPC method ${method}`);
  });
  vi.stubGlobal("fetch", fetch);
  for (const fault of ["throttle", "outage", "malformed"] as const) {
    failure = fault;
    await t.action(internal.trackerActions.drain, {});
    const row = await t.run((ctx) => ctx.db.query("chainTransactions").first());
    expect(row).toMatchObject({ status: "RETRY" });
    expect(await t.run((ctx) => ctx.db.query("pythTrades").first())).toBeNull();
    vi.setSystemTime(row!.nextAttemptAt);
  }
  failure = null;
  await t.action(internal.trackerActions.drain, {});
  const row = await t.run((ctx) => ctx.db.query("chainTransactions").first());
  expect(row).toMatchObject({ status: "STORED", attempts: 4 });
  expect(row?.rawStorageId).toBeTruthy();
  expect((await t.run((ctx) => ctx.db.query("pythTrades").take(2))).length).toBe(1);
  expect((await t.run((ctx) => ctx.db.query("tradeBuckets").first()))?.buyCount).toBe(1);
  expect(await t.mutation(internal.trackerStore.enqueue, {
    signatures: [signature], source: "WEBHOOK",
  })).toBe(0);
  expect(await t.mutation(internal.trackerStore.claim, {})).toEqual([]);
  const metrics = await t.run((ctx) => ctx.db.query("trackerMetrics").take(5));
  expect(metrics.reduce((n, m) => n + m.retries, 0)).toBe(3);
  expect(metrics.reduce((n, m) => n + m.failures, 0)).toBe(0);
});

it("stores a delayed provider decode for review, then refreshes it on retry", async () => {
  const t = await setup();
  const signature = tradeEvidence.signature;
  const rawTransaction = {
    slot: tradeEvidence.rawTransaction.slot,
    blockTime: tradeEvidence.rawTransaction.blockTime,
    transaction: { signatures: [signature], message: { accountKeys: [], instructions: [] } },
    meta: { err: null, preTokenBalances: [], postTokenBalances: [], innerInstructions: [] },
  };
  await t.mutation(internal.trackerStore.enqueue, { signatures: [signature], source: "WEBHOOK" });
  let parsedAvailable = false;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("parsed-events"))
      return Response.json([parsedAvailable
        ? {
            signature,
            parserStatus: "OK",
            parsed: {
              slot: tradeEvidence.rawTransaction.slot,
              blockTime: tradeEvidence.rawTransaction.blockTime,
              transactionStatus: "OK",
              tokenTransfers: [],
              instructions: [],
            },
          }
        : { signature, parserStatus: "UNAVAILABLE" }]);
    const method = JSON.parse(String(init?.body)).method;
    if (method === "getSignatureStatuses")
      return Response.json({ result: { value: [{ confirmationStatus: "finalized", err: null }] } });
    if (method === "getTransaction")
      return Response.json({ result: rawTransaction });
    throw Error(`Unexpected RPC method ${method}`);
  });
  vi.stubGlobal("fetch", fetch);
  await t.action(internal.trackerActions.drain, {});
  const reviewed = await t.run((ctx) => ctx.db.query("chainTransactions").first());
  expect(reviewed).toMatchObject({ status: "PARSE_REVIEW", attempts: 1 });
  expect(reviewed?.error).toBe("Provider could not decode transaction");
  expect(reviewed?.rawStorageId).toBeTruthy();

  parsedAvailable = true;
  vi.setSystemTime(Date.now() + 120000);
  await t.mutation(internal.trackerStore.retryProviderDecode, { id: reviewed!._id });
  await t.action(internal.trackerActions.drain, {});
  const processed = await t.run((ctx) => ctx.db.get(reviewed!._id));
  expect(processed?.status).not.toBe("PARSE_REVIEW");
  expect(processed?.rawStorageId).toBeTruthy();

  const staleStorageId = await t.run((ctx) => ctx.storage.store(new Blob([JSON.stringify({
    payload: { signature, parserStatus: "UNAVAILABLE", rawTransaction },
    finalizedSuccess: true,
  })])));
  await t.run((ctx) => ctx.db.patch(reviewed!._id, { rawStorageId: staleStorageId }));
  await t.mutation(internal.trackerStore.replay, { signature });
  const priorDecodes = fetch.mock.calls.filter(([url]) => url.includes("parsed-events")).length;
  await t.action(internal.trackerActions.drain, {});
  expect(fetch.mock.calls.filter(([url]) => url.includes("parsed-events")).length).toBe(priorDecodes + 1);
  expect((await t.run((ctx) => ctx.db.get(reviewed!._id)))?.status).not.toBe("PARSE_REVIEW");
});

it("stops retrying a persistent provider outage at the eighth attempt", async () => {
  const t = await setup();
  await t.mutation(internal.trackerStore.enqueue, {
    signatures: ["8".repeat(64)], source: "WEBHOOK",
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
  for (let attempt = 1; attempt <= 8; attempt++) {
    await t.action(internal.trackerActions.drain, {});
    const row = await t.run((ctx) => ctx.db.query("chainTransactions").first());
    expect(row).toMatchObject({
      attempts: attempt, status: attempt === 8 ? "FAILED" : "RETRY",
    });
    if (attempt < 8) vi.setSystemTime(row!.nextAttemptAt);
  }
  expect(await t.mutation(internal.trackerStore.claim, {})).toEqual([]);
  const metrics = await t.run((ctx) => ctx.db.query("trackerMetrics").take(5));
  expect(metrics.reduce((n, m) => n + m.retries, 0)).toBe(7);
  expect(metrics.reduce((n, m) => n + m.failures, 0)).toBe(1);
  expect(await t.run((ctx) => ctx.db.query("pythTrades").first())).toBeNull();
});

it("advances a fifty-signature queue across a sustained provider outage", async () => {
  const t = await setup();
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const signatures = Array.from({ length: 50 }, (_, i) =>
    `${alphabet[i]}${"7".repeat(63)}`,
  );
  expect(await t.mutation(internal.trackerStore.enqueue, {
    signatures, source: "WEBHOOK",
  })).toBe(50);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
  for (let round = 1; round <= 2; round++) {
    for (let batch = 0; batch < 10; batch++)
      await t.action(internal.trackerActions.drain, {});
    const rows = await t.run((ctx) => ctx.db.query("chainTransactions").take(51));
    expect(rows).toHaveLength(50);
    expect(rows.every((row) => row.status === "RETRY" && row.attempts === round)).toBe(true);
    if (round === 1) vi.setSystemTime(Math.max(...rows.map((row) => row.nextAttemptAt)));
  }
  expect(await t.run((ctx) => ctx.db.query("pythTrades").first())).toBeNull();
  const metrics = await t.run((ctx) => ctx.db.query("trackerMetrics").take(5));
  expect(metrics.reduce((n, m) => n + m.retries, 0)).toBe(100);
});

it("invalidates an exhausted crash lease and advances past exhausted queue heads", async () => {
  const t = await setup();
  const signature = "2".repeat(64);
  await t.mutation(internal.trackerStore.enqueue, { signatures: [signature], source: "WEBHOOK" });
  let last: { id: Id<"chainTransactions">; lease: string } | null = null;
  for (let attempt = 1; attempt <= 8; attempt++) {
    const [job] = await t.mutation(internal.trackerStore.claim, {});
    expect(job).toBeTruthy();
    last = job;
    vi.setSystemTime(Date.now() + 601000);
  }
  expect(await t.mutation(internal.trackerStore.claim, {})).toEqual([]);
  expect(last).not.toBeNull();
  const failed = await t.run((ctx) => ctx.db.get(last!.id));
  expect(failed).toMatchObject({ status: "FAILED", attempts: 8, lease: null, leaseUntil: null });
  const rawStorageId = await t.run((ctx) => ctx.storage.store(new Blob(["{}"])))
  await t.mutation(internal.trackerStore.finish, {
    id: last!.id, lease: last!.lease, trades: [], orders: [], review: [], rawStorageId,
  });
  expect((await t.run((ctx) => ctx.db.get(last!.id)))?.status).toBe("FAILED");
  expect(await t.run((ctx) => ctx.storage.get(rawStorageId))).toBeNull();
  const metrics = await t.run((ctx) => ctx.db.query("trackerMetrics").take(5));
  expect(metrics.reduce((n, m) => n + m.failures, 0)).toBe(1);

  const healthy = "3".repeat(64);
  await t.mutation(internal.trackerStore.enqueue, { signatures: [healthy], source: "WEBHOOK" });
  await t.run(async (ctx) => {
    for (let i = 0; i < 5; i++)
      await ctx.db.insert("chainTransactions", {
        signature: String(i + 4).repeat(64), status: "RETRY", source: "WEBHOOK",
        attempts: 8, nextAttemptAt: Date.now() - 1, firstSeenAt: Date.now() - 1,
        lease: null, leaseUntil: null, error: null, parserVersion: 16, rawStorageId: null,
      });
  });
  expect((await t.mutation(internal.trackerStore.claim, {})).map((j) => j.signature)).toContain(healthy);
});

it("retains valid volume on reviewed replay and removes it on verified empty correction", async () => {
  const t = await setup();
  const signature = tradeEvidence.signature;
  await t.mutation(internal.trackerStore.enqueue, { signatures: [signature], source: "WEBHOOK" });
  const [first] = await t.mutation(internal.trackerStore.claim, {});
  const { parseEvidence } = await import("../lib/tracker/parsers");
  const { DISCOVERED_PROGRAMS } = await import("../lib/tracker/registry");
  const parsed = parseEvidence(tradeEvidence, signature, true, DISCOVERED_PROGRAMS);
  const initial = await t.run((ctx) => ctx.storage.store(new Blob([JSON.stringify({
    payload: tradeEvidence, finalizedSuccess: true,
  })])));
  await t.mutation(internal.trackerStore.finish, {
    id: first.id, lease: first.lease, trades: parsed.trades, orders: [], review: [],
    rawStorageId: initial,
  });
  expect((await t.run((ctx) => ctx.db.query("tradeBuckets").first()))?.buyCount).toBe(1);

  const reviewed = await t.run((ctx) => ctx.storage.store(new Blob([JSON.stringify({
    payload: { signature, parserStatus: "UNAVAILABLE" }, finalizedSuccess: true,
  })])));
  await t.run((ctx) => ctx.db.patch(first.id, { rawStorageId: reviewed }));
  await t.mutation(internal.trackerStore.replay, { signature });
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("Provider unavailable during replay"); }));
  await t.action(internal.trackerActions.drain, {});
  const reviewRow = await t.run((ctx) => ctx.db.get(first.id));
  expect(reviewRow?.status).toBe("PARSE_REVIEW");
  expect((await t.run((ctx) => ctx.db.query("pythTrades").take(2)))).toHaveLength(1);
  expect((await t.run((ctx) => ctx.db.query("tradeBuckets").first()))?.buyCount).toBe(1);

  const verifiedEmpty = await t.run((ctx) => ctx.storage.store(new Blob([JSON.stringify({
    payload: {
      ...tradeEvidence,
      parserStatus: "OK",
      rawTransaction: {
        ...tradeEvidence.rawTransaction,
        meta: { ...tradeEvidence.rawTransaction.meta, err: { InstructionError: [0, "failed"] } },
      },
      parsed: {
        slot: tradeEvidence.rawTransaction.slot,
        blockTime: tradeEvidence.rawTransaction.blockTime,
        transactionStatus: "ERROR",
        tokenTransfers: [], instructions: [],
      },
    },
  })])));
  await t.run((ctx) => ctx.db.patch(first.id, { rawStorageId: verifiedEmpty }));
  await t.mutation(internal.trackerStore.replay, { signature });
  await t.action(internal.trackerActions.drain, {});
  expect((await t.run((ctx) => ctx.db.get(first.id)))?.status).toBe("IGNORED");
  expect((await t.run((ctx) => ctx.db.query("pythTrades").take(2)))).toHaveLength(0);
  expect((await t.run((ctx) => ctx.db.query("tradeBuckets").first()))?.buyCount).toBe(0);
});
