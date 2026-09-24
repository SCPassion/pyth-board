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
