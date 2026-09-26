/// <reference types="vite/client" />
import { afterEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import { analyzeRawEvidence } from "../lib/tracker/state-analysis";
import { rawDirectVenueTrade } from "../lib/tracker/venues/raw-direct";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import raydium from "./fixtures/positions/raydium-clmm-v2-direct-raw.json";
import orca from "./fixtures/positions/orca-whirlpool-direct-raw.json";
import legacy from "./fixtures/positions/single-pool-exchange-raw.json";

const modules = import.meta.glob("../convex/**/*.ts");
const fixtures = [
  { raw: raydium, router: "RAYDIUM_CLMM", side: "SELL", pythAmountRaw: "3742383943" },
  { raw: orca, router: "ORCA_WHIRLPOOL", side: "BUY", pythAmountRaw: "1158500000" },
] as const;
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("uses reconciled direct pool evidence without a Parsed Events request", async () => {
  vi.useFakeTimers();
  vi.stubEnv("HELIUS_API_KEY", "test-key");
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("trackerState", {
      key: "main", enabled: true, activationTime: 1, activationSlot: 1,
      lastWebhookAt: null, lastProcessedAt: null, lastReconciledAt: null,
      activationEvidence: "isolated raw shortcut test",
    });
    for (const program of DISCOVERED_PROGRAMS)
      await ctx.db.insert("jupiterPrograms", { ...program, source: "test", updatedAt: Date.now() });
  });
  const signatures = fixtures.map(({ raw }) => raw.transaction.signatures[0]);
  await t.mutation(internal.trackerStore.enqueue, { signatures, source: "WEBHOOK" });
  const parsed = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("parsed-events")) {
      parsed();
      throw new Error("Direct pool swaps must not request Parsed Events");
    }
    if (!url.includes("mainnet.helius-rpc.com")) return new Response("", { status: 503 });
    const body = JSON.parse(String(init?.body));
    if (body.method === "getSignatureStatuses")
      return Response.json({ result: { value: [{ confirmationStatus: "finalized", err: null }] } });
    if (body.method === "getTransaction") {
      const fixture = fixtures.find(({ raw }) => raw.transaction.signatures[0] === body.params[0]);
      return Response.json({ result: fixture?.raw ?? null });
    }
    throw new Error(`Unexpected RPC method ${body.method}`);
  }));
  await t.action(internal.trackerActions.drain, {});
  expect(parsed).not.toHaveBeenCalled();
  const trades = await t.run((ctx) => ctx.db.query("pythTrades").collect());
  expect(trades).toHaveLength(2);
  for (const { raw, router, side, pythAmountRaw } of fixtures) {
    const trade = trades.find((t) => t.signature === raw.transaction.signatures[0]);
    expect(trade).toMatchObject({ router, side, pythAmountRaw, ownerConfidence: "MEDIUM", product: "SWAP" });
  }
});

it("keeps unsupported pool instructions on the Parsed Events path", () => {
  const signature = legacy.transaction.signatures[0];
  const analysis = analyzeRawEvidence({ signature, rawTransaction: legacy }, signature, true);
  expect(analysis.confirmedTrades).toHaveLength(1);
  expect(rawDirectVenueTrade(legacy, analysis, DISCOVERED_PROGRAMS)).toBeNull();
});
