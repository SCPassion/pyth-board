import { expect, it } from "vitest";
import { compareHolderRankings, daysBefore } from "../lib/growth/holderRankings";
import { countPythHolders } from "../lib/growth/holders";
it("aggregates exact raw balances across multiple accounts and pages",()=>{
 const account=(owner:number,amount:bigint)=>{const data=Buffer.alloc(40,owner);data.writeBigUInt64LE(amount,32);return {account:{data:[data.toString("base64"),"base64"]}};};
 const owners=new Map<string,bigint>();
 countPythHolders([account(1,9007199254740993n),account(2,0n)],owners);
 const result=countPythHolders([account(1,7n),account(3,5n)],owners);
 expect(result.holders).toBe(2);
 expect([...owners.values()]).toEqual([9007199254741000n,5n]);
});
it("computes signed deltas, rank falls and exact rounded percentages at every period",()=>{
 const today={date:"2026-09-27",collectedAt:10,entries:[{owner:"b",amount:"200"},{owner:"a",amount:"1"}]};
 const old={date:"2026-08-28",collectedAt:1,entries:[{owner:"a",amount:"3"},{owner:"b",amount:"100"}]};
 const result=compareHolderRankings(today,"2026-08-01",{1:old,7:old,30:old});
 expect(result.entries[1].changes).toEqual([1,7,30].map(days=>({days,amountDelta:"-2",percentageDelta:"-66.67",rankDelta:-1,filteredRankDelta:-1})));
 expect(result.entries[0].changes[0].rankDelta).toBe(1);
 expect(daysBefore("2026-03-01",1)).toBe("2026-02-28");
});

it("keeps pooled custody in the recorded top 100 and filters without refilling",async()=>{
 const { selectTopHolders } = await import("../lib/growth/holderExclusions");
 const { HOLDER_ENTITIES, holderView } = await import("../lib/growth/holderEntities");
 const custody=HOLDER_ENTITIES[0].owner;
 const owners=new Map<string,bigint>([[custody,10000n],...Array.from({length:101},(_,i)=>[`wallet${i}`,BigInt(1000-i)] as [string,bigint])]);
 const result=selectTopHolders(owners);
 expect(result.eligibleHolders).toBe(102);
 expect(result.topHolders).toHaveLength(100);
 expect(result.topHolders[0].owner).toBe(custody);
 const recorded=result.topHolders.map((row,i)=>({...row,rank:i+1}));
 expect(holderView(recorded,false)).toHaveLength(100);
 const filtered=holderView(recorded,true);
 expect(filtered).toHaveLength(99);
 expect(filtered[0]).toMatchObject({owner:"wallet0",rank:2,viewRank:1});
 expect(filtered.at(-1)?.owner).toBe("wallet98");
});
it("does not mistake custody movement for a change in filtered rank",async()=>{
 const { HOLDER_ENTITIES, holderView }=await import("../lib/growth/holderEntities");
 const custody=HOLDER_ENTITIES[0].owner;
 const old={date:"2026-09-26",collectedAt:1,entries:[{owner:custody,amount:"400"},{owner:"departed",amount:"300"},{owner:"a",amount:"200"}]};
 const today={date:"2026-09-27",collectedAt:2,entries:[{owner:"a",amount:"250"},{owner:custody,amount:"100"},{owner:"entrant",amount:"50"}]};
 const result=compareHolderRankings(today,"2026-09-26",{1:old});
 expect(result.entries[0].changes[0]).toMatchObject({amountDelta:"50",rankDelta:2,filteredRankDelta:1});
 expect(result.entries[1].changes[0].filteredRankDelta).toBeNull();
 expect(result.entries[2].changes[0].filteredRankDelta).toBeNull();
 const trading=HOLDER_ENTITIES.filter(e=>e.category==="trading firm").map((e,i)=>({owner:e.owner,rank:i+1}));
 expect(holderView(trading,true)).toHaveLength(2);
 expect(new Set(HOLDER_ENTITIES.map(e=>e.owner)).size).toBe(HOLDER_ENTITIES.length);
});
