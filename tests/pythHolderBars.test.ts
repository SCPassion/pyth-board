import { expect, it } from "vitest";
import { holderBarBalances, holderBarWidths } from "../lib/growth/holderBars";
it("splits increases and decreases on a shared scale",()=>{
 expect(holderBarWidths("2500000000000","500000000000",2500000000000n)).toEqual({retained:80,added:20,removed:0});
 expect(holderBarWidths("1500000000000","-500000000000",2500000000000n)).toEqual({retained:60,added:0,removed:20});
 expect(holderBarWidths("2000000000000","0",2500000000000n)).toEqual({retained:80,added:0,removed:0});
});
it("keeps unknown history cyan and raw amounts exact above float precision",()=>{
 expect(holderBarWidths("2500000000000",null,2500000000000n)).toEqual({retained:100,added:0,removed:0});
 expect(holderBarBalances("9007199254740993","1")).toEqual({current:9007199254740993n,previous:9007199254740992n,retained:9007199254740992n,added:1n,removed:0n});
 expect(holderBarWidths("1","1",0n)).toEqual({retained:0,added:0,removed:0});
});
