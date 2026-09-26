/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect, vi, afterEach } from "vitest";
import schema from "../convex/schema";
import { internal, api } from "../convex/_generated/api";
import { parseTransaction } from "../lib/tracker/parsers";
import { decodeHelius } from "../lib/tracker/helius-format";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import fixture from "./fixtures/jupiter/recurring-buy-1.json";
import { PARSER_VERSION } from "../lib/tracker/config";
import { PARSED_BATCH_SIZE, PARSED_COALESCE_MS } from "../convex/heliusClient";
const modules = import.meta.glob("../convex/**/*.ts");
afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("trackerState", {
      key: "main",
      enabled: true,
      activationTime: 1,
      activationSlot: 1,
      lastWebhookAt: null,
      lastReconciledAt: null,
      lastProcessedAt: null,
      activationEvidence: "test",
    });
  });
  return t;
}
describe("tracker persistence", () => {
  it("keeps one coalescing timer and replaces it only for a full batch", async () => {
    const t = await setup();
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const signatures = [...alphabet].slice(0, PARSED_BATCH_SIZE).map((character) => character + fixture.signature.slice(1));
    await t.mutation(internal.trackerStore.enqueue, { signatures: signatures.slice(0, 1), source: "WEBHOOK" });
    const first = await t.run((ctx) => ctx.db.query("trackerState").first());
    expect(first?.drainWakeupId).toBeTruthy();
    expect(first?.drainDueAt).toBe(Date.now() + PARSED_COALESCE_MS);
    await t.mutation(internal.trackerStore.enqueue, { signatures: signatures.slice(1, 2), source: "WEBHOOK" });
    const second = await t.run((ctx) => ctx.db.query("trackerState").first());
    expect(second?.drainWakeupId).toBe(first?.drainWakeupId);
    await t.mutation(internal.trackerStore.enqueue, { signatures: signatures.slice(2), source: "WEBHOOK" });
    const full = await t.run((ctx) => ctx.db.query("trackerState").first());
    expect(full?.drainWakeupId).not.toBe(first?.drainWakeupId);
    expect(full?.drainDueAt).toBe(Date.now());
    await t.mutation(internal.trackerStore.startScheduledDrain, { token: first!.drainToken! });
    expect((await t.run((ctx) => ctx.db.query("trackerState").first()))?.drainToken).toBe(full?.drainToken);
  });
  it("claims at most one full batch and leaves a measurable tail", async () => {
    const t = await setup();
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const signatures = [...alphabet].slice(0, PARSED_BATCH_SIZE + 1).map((character) => character + fixture.signature.slice(1));
    expect(await t.mutation(internal.trackerStore.enqueue, { signatures, source: "WEBHOOK" })).toBe(PARSED_BATCH_SIZE + 1);
    expect(await t.mutation(internal.trackerStore.claim, {})).toHaveLength(PARSED_BATCH_SIZE);
    expect(await t.query(internal.trackerStore.pendingCount, {})).toBe(1);
    expect(await t.mutation(internal.trackerStore.claim, {})).toHaveLength(1);
  });
  it("coalesces transient retries without advancing their backoff", async () => {
    const t = await setup();
    const signatures = [fixture.signature, "2" + fixture.signature.slice(1)];
    await t.mutation(internal.trackerStore.enqueue, { signatures, source: "WEBHOOK" });
    const initial = await t.run((ctx) => ctx.db.query("trackerState").first());
    await t.mutation(internal.trackerStore.startScheduledDrain, { token: initial!.drainToken! });
    const jobs = await t.mutation(internal.trackerStore.claim, {});
    expect(jobs).toHaveLength(2);
    for (const job of jobs)
      await t.mutation(internal.trackerStore.fail, {
        id: job.id, lease: job.lease, reason: "Provider unavailable", transient: true,
      });
    const retryAt = (await t.run((ctx) => ctx.db.get(jobs[0].id)))!.nextAttemptAt;
    vi.setSystemTime(retryAt - 1);
    await t.mutation(internal.trackerStore.wakeRetry, { id: jobs[0].id, nextAttemptAt: retryAt });
    expect((await t.run((ctx) => ctx.db.query("trackerState").first()))?.drainWakeupId).toBeUndefined();
    vi.setSystemTime(retryAt);
    await t.mutation(internal.trackerStore.wakeRetry, { id: jobs[0].id, nextAttemptAt: retryAt });
    const first = await t.run((ctx) => ctx.db.query("trackerState").first());
    await t.mutation(internal.trackerStore.wakeRetry, { id: jobs[1].id, nextAttemptAt: retryAt });
    const second = await t.run((ctx) => ctx.db.query("trackerState").first());
    expect(second?.drainWakeupId).toBe(first?.drainWakeupId);
    expect(second?.drainDueAt).toBe(retryAt + PARSED_COALESCE_MS);
    vi.setSystemTime(second!.drainDueAt!);
    await t.mutation(internal.trackerStore.startScheduledDrain, { token: second!.drainToken! });
    expect(await t.mutation(internal.trackerStore.claim, {})).toHaveLength(2);
  });
  it("recovers delayed provider reviews in one batch with retained evidence", async () => {
    const t = await setup();
    const signatures = [fixture.signature, "2" + fixture.signature.slice(1)];
    await t.mutation(internal.trackerStore.enqueue, { signatures, source: "WEBHOOK" });
    const initial = await t.run((ctx) => ctx.db.query("trackerState").first());
    await t.mutation(internal.trackerStore.startScheduledDrain, { token: initial!.drainToken! });
    const jobs = await t.mutation(internal.trackerStore.claim, {});
    for (const job of jobs) {
      const rawStorageId = await t.run((ctx) => ctx.storage.store(new Blob(["{}"])));
      await t.run((ctx) => ctx.db.patch(job.id, {
        status: "PARSE_REVIEW", source: "WEBHOOK", error: "Provider could not decode transaction",
        rawStorageId, lease: null, leaseUntil: null,
      }));
      await t.mutation(internal.trackerStore.retryProviderDecode, { id: job.id });
    }
    const scheduled = await t.run((ctx) => ctx.db.query("trackerState").first());
    expect(scheduled?.drainWakeupId).toBeTruthy();
    vi.setSystemTime(scheduled!.drainDueAt!);
    await t.mutation(internal.trackerStore.startScheduledDrain, { token: scheduled!.drainToken! });
    const retried = await t.mutation(internal.trackerStore.claim, {});
    expect(retried).toHaveLength(2);
    expect(retried.every((job) => job.replayStorageId)).toBe(true);
  });
  it("coalesces expired leases and still reclaims every job", async () => {
    const t = await setup();
    const signatures = [fixture.signature, "2" + fixture.signature.slice(1)];
    await t.mutation(internal.trackerStore.enqueue, { signatures, source: "WEBHOOK" });
    const initial = await t.run((ctx) => ctx.db.query("trackerState").first());
    await t.mutation(internal.trackerStore.startScheduledDrain, { token: initial!.drainToken! });
    const jobs = await t.mutation(internal.trackerStore.claim, {});
    const leaseUntil = (await t.run((ctx) => ctx.db.get(jobs[0].id)))!.leaseUntil!;
    vi.setSystemTime(leaseUntil);
    for (const job of jobs)
      await t.mutation(internal.trackerStore.wakeExpiredLease, { id: job.id, lease: job.lease });
    const scheduled = await t.run((ctx) => ctx.db.query("trackerState").first());
    expect(scheduled?.drainDueAt).toBe(leaseUntil + PARSED_COALESCE_MS);
    vi.setSystemTime(scheduled!.drainDueAt!);
    await t.mutation(internal.trackerStore.startScheduledDrain, { token: scheduled!.drainToken! });
    expect(await t.mutation(internal.trackerStore.claim, {})).toHaveLength(2);
  });
  it.each(["legacy-trade", "legacy-empty", "current-empty"])(
    "records the worker version and selects upgrades for replay: %s", async (mode) => {
      const t = await setup();
      const signature = fixture.signature;
      await t.mutation(internal.trackerStore.enqueue, { signatures: [signature], source: "WEBHOOK" });
      const job = (await t.mutation(internal.trackerStore.claim, {}))[0];
      const trades = mode === "legacy-trade"
        ? parseTransaction(decodeHelius(fixture), DISCOVERED_PROGRAMS).trades.map((trade) => ({ ...trade, parserVersion: PARSER_VERSION - 1 }))
        : [];
      const rawStorageId = await t.run((ctx) => ctx.storage.store(new Blob(["{}"])));
      await t.mutation(internal.trackerStore.finish, {
        id: job.id, lease: job.lease, trades, orders: [], review: [], rawStorageId,
        ...(mode === "current-empty" ? { parserVersion: PARSER_VERSION } : {}),
      });
      expect((await t.run((ctx) => ctx.db.get(job.id)))!.parserVersion).toBe(
        mode === "legacy-trade" ? PARSER_VERSION - 1 : mode === "legacy-empty" ? 0 : PARSER_VERSION,
      );
      const replay = await t.mutation(internal.trackerStore.replayParserPage, {
        paginationOpts: { numItems: 50, cursor: null },
      });
      expect(replay.queued).toBe(mode === "current-empty" ? 0 : 1);
      if (mode !== "current-empty") {
        const next = (await t.mutation(internal.trackerStore.claim, {}))[0];
        expect(next.replayStorageId).toBe(rawStorageId);
        const raw2 = await t.run((ctx) => ctx.storage.store(new Blob(["{}"])));
        await t.mutation(internal.trackerStore.finish, {
          id: next.id, lease: next.lease, trades: [], orders: [], review: [],
          rawStorageId: raw2, parserVersion: PARSER_VERSION,
        });
        expect(await t.query(api.trackerQueries.bySignature, { signature })).toEqual([]);
        const buckets = await t.run((ctx) => ctx.db.query("tradeBuckets").collect());
        expect(buckets.every((b) => b.buyRaw === "0" && b.buyCount === 0)).toBe(true);
      }
    },
  );
  it("rejects a completion carrying inconsistent parser versions atomically", async () => {
    const t = await setup();
    await t.mutation(internal.trackerStore.enqueue, { signatures: [fixture.signature], source: "WEBHOOK" });
    const job = (await t.mutation(internal.trackerStore.claim, {}))[0];
    const rawStorageId = await t.run((ctx) => ctx.storage.store(new Blob(["{}"])));
    await expect(t.mutation(internal.trackerStore.finish, {
      id: job.id, lease: job.lease, rawStorageId, orders: [], review: [],
      trades: parseTransaction(decodeHelius(fixture), DISCOVERED_PROGRAMS).trades,
      parserVersion: PARSER_VERSION - 1,
    })).rejects.toThrow("Inconsistent parser version");
    expect((await t.run((ctx) => ctx.db.get(job.id)))!.status).toBe("FETCHING");
    expect(await t.query(api.trackerQueries.bySignature, { signature: fixture.signature })).toEqual([]);
  });
  it("deduplicates concurrent delivery and applies replacement aggregates once", async () => {
    const t = await setup();
    const trades = parseTransaction(
      decodeHelius(fixture),
      DISCOVERED_PROGRAMS,
    ).trades;
    const signature = fixture.signature;
    await Promise.all([
      t.mutation(internal.trackerStore.enqueue, {
        signatures: [signature],
        source: "WEBHOOK",
      }),
      t.mutation(internal.trackerStore.enqueue, {
        signatures: [signature],
        source: "WEBHOOK",
      }),
    ]);
    const jobs = await t.mutation(internal.trackerStore.claim, {});
    expect(jobs).toHaveLength(1);
    const job = jobs[0];
    const rawStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["{}"])),
    );
    const args = {
      id: job.id,
      lease: job.lease,
      trades,
      orders: [],
      review: [],
      rawStorageId,
    };
    await t.mutation(internal.trackerStore.finish, args);
    const rows = await t.query(api.trackerQueries.bySignature, { signature });
    expect(rows).toHaveLength(1);
    await t.mutation(internal.trackerStore.replay, { signature });
    const replay = (await t.mutation(internal.trackerStore.claim, {}))[0];
    const raw2 = await t.run((ctx) => ctx.storage.store(new Blob(["{}"])));
    await t.mutation(internal.trackerStore.finish, {
      ...args,
      id: replay.id,
      lease: replay.lease,
      rawStorageId: raw2,
    });
    const buckets = await t.run((ctx) =>
      ctx.db.query("tradeBuckets").collect(),
    );
    expect(buckets[0].buyCount).toBe(1);
    expect(buckets[0].buyRaw).toBe(trades[0].pythAmountRaw);
  });
  it("does not publish trades before activation", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      const s = await ctx.db.query("trackerState").first();
      await ctx.db.patch(s!._id, { activationTime: Date.now() });
    });
    await t.mutation(internal.trackerStore.enqueue, {
      signatures: [fixture.signature],
      source: "WEBHOOK",
    });
    const job = (await t.mutation(internal.trackerStore.claim, {}))[0];
    const rawStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["{}"])),
    );
    await t.mutation(internal.trackerStore.finish, {
      id: job.id,
      lease: job.lease,
      trades: parseTransaction(decodeHelius(fixture), DISCOVERED_PROGRAMS)
        .trades,
      orders: [],
      review: [],
      rawStorageId,
    });
    expect(
      await t.query(api.trackerQueries.bySignature, {
        signature: fixture.signature,
      }),
    ).toEqual([]);
  });
  it("rejects activation without all verified product gates", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.trackerStore.setEnabled, {
        enabled: true,
        activationSlot: 1,
        evidence: "test",
      }),
    ).rejects.toThrow("fixture gates");
  });
  it("starts webhook-only collection with a fixed history boundary and partial coverage", async () => {
    vi.useFakeTimers();
    const oldKey = process.env.HELIUS_API_KEY;
    process.env.HELIUS_API_KEY = "test-key";
    try {
      const t = convexTest(schema, modules);
      await expect(t.mutation(internal.trackerStore.enableWebhooks, { evidence: " " }))
        .rejects.toThrow("evidence required");
      await t.mutation(internal.trackerStore.enableWebhooks, {
        evidence: "Webhook-only release; delivery gaps verified; no backfill",
      });
      const first = await t.query(api.trackerQueries.health, {});
      expect(first.enabled).toBe(true);
      expect(first.fullCoverage).toBe(false);
      expect(first.activationTime).toBeGreaterThan(0);
      await t.mutation(internal.trackerStore.enableWebhooks, {
        evidence: "Webhook-only resume; partial coverage",
      });
      expect((await t.query(api.trackerQueries.health, {})).activationTime)
        .toBe(first.activationTime);
      await t.mutation(internal.trackerStore.setEnabled, { enabled: false });
      const paused = await t.query(api.trackerQueries.health, {});
      expect(paused.enabled).toBe(false);
      expect(paused.activationTime).toBe(first.activationTime);
    } finally {
      if (oldKey === undefined) delete process.env.HELIUS_API_KEY;
      else process.env.HELIUS_API_KEY = oldKey;
    }
  });
  it("caps transient retries and reclaims expired leases", async () => {
    const t = await setup();
    await t.mutation(internal.trackerStore.enqueue, {
      signatures: [fixture.signature],
      source: "WEBHOOK",
    });
    const first = (await t.mutation(internal.trackerStore.claim, {}))[0];
    expect(await t.mutation(internal.trackerStore.claim, {})).toEqual([]);
    vi.setSystemTime(Date.now() + 601000);
    const second = (await t.mutation(internal.trackerStore.claim, {}))[0];
    expect(second.lease).not.toBe(first.lease);
    await t.mutation(internal.trackerStore.fail, {
      id: second.id,
      lease: first.lease,
      reason: "stale attempt",
      transient: true,
    });
    const row = await t.run((ctx) => ctx.db.get(second.id));
    expect(row!.status).toBe("FETCHING");
  });
});

describe("public query boundaries", () => {
  it("returns validated pagination responses without provider-specific extra fields", async () => {
    const t = await setup();
    const page = await t.query(api.trackerQueries.recent, {
      from: 1,
      to: 3600001,
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(Object.keys(page).sort()).toEqual([
      "continueCursor",
      "isDone",
      "page",
    ]);
  });
  it("preserves the last valid trade when replay needs review, including its raw evidence", async () => {
    const t = await setup();
    const signature = fixture.signature;
    await t.mutation(internal.trackerStore.enqueue, {
      signatures: [signature],
      source: "WEBHOOK",
    });
    const job = (await t.mutation(internal.trackerStore.claim, {}))[0];
    const trades = parseTransaction(
      decodeHelius(fixture),
      DISCOVERED_PROGRAMS,
    ).trades;
    const rawStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["{}"])),
    );
    const args = {
      id: job.id,
      lease: job.lease,
      trades,
      orders: [],
      review: [],
      rawStorageId,
    };
    await t.mutation(internal.trackerStore.finish, args);
    await t.mutation(internal.trackerStore.finish, args);
    expect(
      await t.run((ctx) => ctx.storage.getUrl(rawStorageId)),
    ).not.toBeNull();
    await t.mutation(internal.trackerStore.replay, { signature });
    const replay = (await t.mutation(internal.trackerStore.claim, {}))[0];
    expect(replay.replayStorageId).toBe(rawStorageId);
    const raw2 = await t.run((ctx) => ctx.storage.store(new Blob(["{}"])));
    await t.mutation(internal.trackerStore.finish, {
      id: replay.id,
      lease: replay.lease,
      trades: [],
      orders: [],
      review: ["New parser could not classify"],
      rawStorageId: raw2,
    });
    expect(
      await t.query(api.trackerQueries.bySignature, { signature }),
    ).toHaveLength(1);
    expect((await t.query(api.trackerQueries.health, {})).needsReview).toBe(
      true,
    );
  });
  it("uses hourly buckets and exact boundary trades without double counting", async () => {
    const t = await setup();
    const base = parseTransaction(decodeHelius(fixture), DISCOVERED_PROGRAMS)
      .trades[0];
    const to = 10 * 3600000 + 1800000;
    const positions = [to - 3600001, to - 3600000, to - 1, to];
    for (let i = 0; i < positions.length; i++) {
      const signature = String.fromCharCode(65 + i).repeat(88);
      await t.mutation(internal.trackerStore.enqueue, {
        signatures: [signature],
        source: "WEBHOOK",
      });
      const job = (await t.mutation(internal.trackerStore.claim, {}))[0];
      const rawStorageId = await t.run((ctx) =>
        ctx.storage.store(new Blob(["{}"])),
      );
      await t.mutation(internal.trackerStore.finish, {
        id: job.id,
        lease: job.lease,
        trades: [
          {
            ...base,
            signature,
            tradeId: `${signature}:1`,
            blockTime: positions[i],
          },
        ],
        orders: [],
        review: [],
        rawStorageId,
      });
    }
    const overview = await t.query(api.trackerQueries.overview, {
      window: "1h",
      to,
    });
    expect(overview.summary.buyCount).toBe(2);
    expect(overview.complete).toBe(true);
    const rankings = await t.query(api.trackerQueries.rankings, {
      window: "1h",
      to,
    });
    expect(rankings.buyers[0].buyCount).toBe(2);
    const ownerOverview = await t.query(api.trackerQueries.ownerOverview, {
      owner: base.owner!, window: "1h", to,
    });
    expect(ownerOverview.complete).toBe(true);
    expect(ownerOverview.summary.buyCount).toBe(2);
    expect(ownerOverview.series.reduce((sum, point) => sum + point.buyCount, 0)).toBe(2);
    expect((await t.query(api.trackerQueries.rankings, {
      window: "1h", to, excludeOwner: base.owner!,
    })).buyers).toHaveLength(0);
  });
  it("combines distinct excluded wallets once and keeps other wallets ranked", async () => {
    const t = await setup();
    const base = parseTransaction(decodeHelius(fixture), DISCOVERED_PROGRAMS).trades[0];
    const to = Math.floor(Date.now() / 3600000) * 3600000 + 1800000;
    const owners = [base.owner!, "SecondWallet", "OtherWallet"];
    for (const [i, owner] of owners.entries()) {
      const signature = String.fromCharCode(80 + i).repeat(88);
      await t.mutation(internal.trackerStore.enqueue, { signatures: [signature], source: "WEBHOOK" });
      const job = (await t.mutation(internal.trackerStore.claim, {}))[0];
      const rawStorageId = await t.run((ctx) => ctx.storage.store(new Blob(["{}"])));
      await t.mutation(internal.trackerStore.finish, {
        id: job.id,
        lease: job.lease,
        trades: [{
          ...base, signature, tradeId: `${signature}:1`, owner,
          ownerConfidence: "HIGH", blockTime: to - (i + 1) * 60000,
        }],
        orders: [], review: [], rawStorageId,
      });
    }
    const excluded = await t.query(api.trackerQueries.ownerOverview, {
      owners: [owners[0], owners[1], owners[0]], window: "1h", to,
    });
    expect(excluded.complete).toBe(true);
    expect(excluded.summary.buyCount).toBe(2);
    const rankings = await t.query(api.trackerQueries.rankings, {
      window: "1h", to, excludeOwners: [owners[0], owners[1]],
    });
    expect(rankings.buyers.map((row) => row.owner)).toEqual([owners[2]]);
  });
  it("includes the full collected history beyond 30 days in the since-start view", async () => {
    const t = await setup();
    const to = Math.floor(Date.now() / 60000) * 60000;
    const day = 86400000;
    const activationTime = to - 45 * day;
    await t.run(async (ctx) => {
      const state = await ctx.db.query("trackerState").first();
      await ctx.db.patch(state!._id, { activationTime });
    });
    const base = parseTransaction(decodeHelius(fixture), DISCOVERED_PROGRAMS).trades[0];
    for (const [i, blockTime] of [to - 40 * day, to - day].entries()) {
      const signature = String.fromCharCode(75 + i).repeat(88);
      await t.mutation(internal.trackerStore.enqueue, { signatures: [signature], source: "WEBHOOK" });
      const job = (await t.mutation(internal.trackerStore.claim, {}))[0];
      const rawStorageId = await t.run((ctx) => ctx.storage.store(new Blob(["{}"])));
      await t.mutation(internal.trackerStore.finish, {
        id: job.id,
        lease: job.lease,
        trades: [{ ...base, signature, tradeId: `${signature}:1`, blockTime }],
        orders: [],
        review: [],
        rawStorageId,
      });
    }
    const overview = await t.query(api.trackerQueries.overview, { window: "since", to });
    expect(overview.from).toBe(activationTime);
    expect(overview.complete).toBe(true);
    expect(overview.summary.buyCount).toBe(2);
    expect(overview.series).toHaveLength(2);
    expect(overview.series.every((point) => point.time % day === 0)).toBe(true);
    expect((await t.query(api.trackerQueries.overview, { window: "30d", to })).summary.buyCount).toBe(1);
    const rankings = await t.query(api.trackerQueries.rankings, { window: "since", to });
    expect(rankings.buyers[0].buyCount).toBe(2);
    const ownerOverview = await t.query(api.trackerQueries.ownerOverview, {
      owner: base.owner!, window: "since", to,
    });
    expect(ownerOverview.summary.buyCount).toBe(2);
    expect(ownerOverview.series).toHaveLength(2);
    expect(ownerOverview.series.every((point) => point.time % day === 0)).toBe(true);
    const recent = await t.query(api.trackerQueries.recent, {
      from: activationTime,
      to,
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(recent.page).toHaveLength(2);
  });
});
