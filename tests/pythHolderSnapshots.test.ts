/// <reference types="vite/client" />
import { expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { internal, api } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
const a = "1".repeat(32), b = "2".repeat(32), c = "3".repeat(32);
const args = (date: string, topHolders = [{owner:a,amount:"9000000"},{owner:b,amount:"6000000"}]) => ({ eligibleHolders:2,holders:2,collectedAt:Date.parse(`${date}T03:00:00Z`),totalTokenAccounts:4,positiveTokenAccounts:3,topHolders });
it("keeps canonical snapshots, compares owners rather than ranks and rejects invalid input atomically", async () => {
 const t = convexTest(schema, modules);
 await t.mutation(internal.pythHolders.store,args("2026-09-10"));
 await t.mutation(internal.pythHolders.store,args("2026-09-10",[{owner:a,amount:"10000000"},{owner:b,amount:"6000000"}]));
 await t.mutation(internal.pythHolders.store,args("2026-09-11",[{owner:b,amount:"12000000"},{owner:c,amount:"1000000"}]));
 const latest = await t.query(api.pythHolderRankings.latest,{});
 expect(latest?.entries[0].changes[0]).toEqual({days:1,amountDelta:"6000000",percentageDelta:"100.00",rankDelta:1,filteredRankDelta:1});
 expect(latest?.entries[1].changes[0].amountDelta).toBeNull();
 expect(latest?.periods.map(p=>p.status)).toEqual(["ready","collecting","collecting"]);
 await expect(t.mutation(internal.pythHolders.store,{...args("2026-09-12"),holders:0})).rejects.toThrow();
 await expect(t.mutation(internal.pythHolders.store,args("2026-09-12",[{owner:a,amount:"1"},{owner:a,amount:"1"}]))).rejects.toThrow();
 expect(await t.query(api.pythHolderRankings.latest,{})).toEqual(latest);
 expect(await t.run(ctx=>ctx.db.query("pythHolderSnapshots").collect())).toHaveLength(2);
});
it("seeds rankings alongside existing counts, distinguishes gaps, and retains only 35 calendar days",async()=>{
 const t = convexTest(schema, modules);
 await t.run(ctx=>ctx.db.insert("pythHolderSnapshots",{date:"2026-08-01",holders:2,collectedAt:args("2026-08-01").collectedAt,totalTokenAccounts:4,positiveTokenAccounts:3}));
 expect(await t.query(internal.pythHolders.hasDate,{date:"2026-08-01"})).toBe(false);
 await t.mutation(internal.pythHolders.store,args("2026-08-01"));
 expect(await t.query(internal.pythHolders.hasDate,{date:"2026-08-01"})).toBe(true);
 for(let day=2;day<=31;day++) await t.mutation(internal.pythHolders.store,args(`2026-08-${String(day).padStart(2,"0")}`));
 await t.mutation(internal.pythHolders.store,args("2026-09-01"));
 expect((await t.query(api.pythHolderRankings.latest,{}))?.periods[2].status).toBe("ready");
 await t.mutation(internal.pythHolders.store,args("2026-09-05"));
 const latest = await t.query(api.pythHolderRankings.latest,{});
 expect(latest?.periods[0].status).toBe("missing");
 expect(latest?.firstDate).toBe("2026-08-01");
 const history=await t.run(ctx=>ctx.db.query("pythHolderRankingSnapshots").withIndex("by_date").collect());
 expect(history[0].date).toBe("2026-08-02");
 expect(latest).not.toHaveProperty("_id");
});
it("refreshes legacy rankings without changing canonical counts and resets incompatible history",async()=>{
 const t=convexTest(schema,modules);
 await t.mutation(internal.pythHolders.store,args("2026-09-10"));
 await t.run(async ctx=>{
  const history=await ctx.db.query("pythHolderRankingSnapshots").first();
  const cache=await ctx.db.query("pythHolderLeaderboard").first();
  await ctx.db.patch(history!._id,{exclusionKey:"old-policy"});
  await ctx.db.patch(cache!._id,{exclusionKey:"old-policy"});
 });
 expect(await t.query(internal.pythHolders.hasDate,{date:"2026-09-10"})).toBe(false);
 expect(await t.query(api.pythHolderRankings.latest,{})).toBeNull();
 await t.mutation(internal.pythHolders.store,{...args("2026-09-10"),holders:3,positiveTokenAccounts:3});
 expect((await t.query(api.pythHolders.latest,{}))?.holders).toBe(2);
 expect(await t.run(ctx=>ctx.db.query("pythHolderRankingSnapshots").collect())).toHaveLength(1);
 await t.run(async ctx=>{
  const history=await ctx.db.query("pythHolderRankingSnapshots").first();
  const cache=await ctx.db.query("pythHolderLeaderboard").first();
  await ctx.db.patch(history!._id,{exclusionKey:"old-policy"});
  await ctx.db.patch(cache!._id,{exclusionKey:"old-policy"});
 });
 await t.mutation(internal.pythHolders.store,args("2026-09-11"));
 const latest=await t.query(api.pythHolderRankings.latest,{});
 expect(latest?.firstDate).toBe("2026-09-11");
 expect(latest?.periods[0].status).toBe("collecting");
 expect(latest?.entries[0].changes[0].rankDelta).toBeNull();
 expect(latest?.exclusions).toEqual([]);
});
it("records pooled custody so the default view includes it",async()=>{
 const { HOLDER_ENTITIES }=await import("../lib/growth/holderEntities");
 const t=convexTest(schema,modules);
 await t.mutation(internal.pythHolders.store,args("2026-09-10",[{owner:HOLDER_ENTITIES[0].owner,amount:"9000000"},{owner:b,amount:"1"}]));
 expect((await t.query(api.pythHolderRankings.latest,{}))?.entries[0].owner).toBe(HOLDER_ENTITIES[0].owner);
});

it("lets an old in-flight collector store counts and a new collector add rankings",async()=>{
 const t=convexTest(schema,modules);
 const { topHolders, eligibleHolders, ...oldArgs }=args("2026-09-10");
 await t.mutation(internal.pythHolders.store,oldArgs);
 expect((await t.query(api.pythHolders.latest,{}))?.holders).toBe(2);
 expect(await t.query(api.pythHolderRankings.latest,{})).toBeNull();
 expect(await t.query(internal.pythHolders.hasDate,{date:"2026-09-10"})).toBe(false);
 await expect(t.mutation(internal.pythHolders.store,{...oldArgs,topHolders})).rejects.toThrow("ranking arguments");
 await expect(t.mutation(internal.pythHolders.store,{...oldArgs,eligibleHolders})).rejects.toThrow("ranking arguments");
 await t.mutation(internal.pythHolders.store,{...oldArgs,topHolders,eligibleHolders});
 expect(await t.query(internal.pythHolders.hasDate,{date:"2026-09-10"})).toBe(true);
 expect(await t.run(ctx=>ctx.db.query("pythHolderSnapshots").collect())).toHaveLength(1);
});
