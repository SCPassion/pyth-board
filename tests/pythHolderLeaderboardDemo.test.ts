import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PublicKey } from "@solana/web3.js";
import { compareHolderRankings, daysBefore } from "../lib/growth/holderRankings";
import { HOLDER_ENTITIES } from "../lib/growth/holderEntities";
import { PythHolderLeaderboard } from "../components/pyth-holder-leaderboard";

const demo = vi.hoisted(() => ({ snapshot: null as unknown, days: 1, limit: 10, filtered: false }));
vi.mock("convex/react", () => ({ useQuery: () => demo.snapshot }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => [typeof initial === "boolean" ? demo.filtered : initial === 10 ? demo.limit : demo.days, () => {}],
}));
const address = (seed: number) => new PublicKey(new Uint8Array(32).fill(seed)).toBase58();
const custody = HOLDER_ENTITIES.find(entity => entity.category === "staking custody")!.owner;
const jump = HOLDER_ENTITIES.find(entity => entity.label.startsWith("Jump Crypto"))!.owner;
const gain = address(10), flat = address(11), entrant = address(12), micro = address(13);
const rows = [
 { owner: custody, amount: "100000000000000" },
 { owner: gain, amount: "2500000000000" },
 { owner: jump, amount: "1500000000000" },
 { owner: flat, amount: "1000000000000" },
 { owner: entrant, amount: "500000000000" },
 { owner: micro, amount: "250000123457" },
 ...Array.from({length:94}, (_,i) => ({owner:address(i+40),amount:String((10_000n-BigInt(i))*1_000_000n)})),
];
const date="2026-09-27", collectedAt=Date.parse(`${date}T03:00:00Z`);
const today={date,collectedAt,entries:rows};
const baseline=[
 {owner:custody,amount:"80000000000000"},
 {owner:jump,amount:"2000000000000"},
 {owner:gain,amount:"2000000000000"},
 {owner:address(14),amount:"1200000000000"},
 {owner:flat,amount:"1000000000000"},
 {owner:micro,amount:"250000123456"},
 ...rows.slice(6),
];
const historical=(days:number,entries=baseline)=>({date:daysBefore(date,days),collectedAt:collectedAt-days*86400000,entries});
const seven=baseline.map(row=>({...row,amount:(BigInt(row.amount)*2n).toString()}));
const thirty=baseline.map(row=>({...row,amount:(BigInt(row.amount)/2n).toString()}));
const snapshot={date,collectedAt,firstDate:"2026-08-28",exclusions:[],...compareHolderRankings(today,"2026-08-28",{1:historical(1),7:historical(7,seven),30:historical(30,thirty)})};
function render(days=1,filtered=false,limit=10,data:unknown=snapshot){
 Object.assign(demo,{snapshot:data,days,filtered,limit});
 return renderToStaticMarkup(createElement(PythHolderLeaderboard));
}
function ownerRow(html:string,owner:string){
 return html.split("<li ").find(row=>row.includes(`https://solscan.io/account/${owner}`))!;
}

describe("synthetic holder change display through the real leaderboard component",()=>{
 it("renders gains, losses, zero and one raw token unit accurately",()=>{
  const html=render();
  expect(ownerRow(html,gain)).toContain("+500,000");
  expect(ownerRow(html,gain)).toContain("+25.00%");
  expect(html).toContain("PYTH ownership activity");
  expect(html).toContain("The largest native PYTH balances and how their holdings change over time.");
  expect(ownerRow(html,custody)).toContain("width:80%");
  expect(ownerRow(html,custody)).toContain("width:20%");
  expect(ownerRow(html,gain)).toContain("width:2%");
  expect(ownerRow(html,gain)).toContain("width:0.5%");
  expect(ownerRow(html,gain)).toContain("bg-emerald-300");
  expect(ownerRow(html,jump)).toContain("width:1.5%");
  expect(ownerRow(html,jump)).toContain("width:0.5%");
  expect(ownerRow(html,jump)).toContain("border-dashed");
  expect(ownerRow(html,flat)).not.toContain("border-dashed");
  expect(ownerRow(html,gain)).toContain("text-emerald-300");
  expect(ownerRow(html,gain)).toContain("Rank improved by 1");
  expect(ownerRow(html,jump)).toContain("−500,000");
  expect(ownerRow(html,jump)).toContain("-25.00%");
  expect(ownerRow(html,jump)).toContain("text-rose-300");
  expect(ownerRow(html,jump)).toContain("Rank fell by 1");
  expect(ownerRow(html,flat)).toContain("0.00%");
  expect(ownerRow(html,micro)).toContain("+0.000001");
  expect(ownerRow(html,micro)).not.toContain("+0.00%");
 });
 it("never invents zero balances for an entrant or missing history",()=>{
  const html=render();
  expect(ownerRow(html,entrant)).toContain("New to top 100");
  expect(ownerRow(html,entrant)).toContain("previous balance unknown");
  expect(ownerRow(html,entrant)).not.toContain("bg-emerald-300");
  expect(ownerRow(html,entrant)).not.toContain("border-dashed");
  const missing={...snapshot,...compareHolderRankings(today,"2026-08-28",{})};
  const missingHtml=render(1,false,10,missing);
  expect(missingHtml).toContain("Snapshot unavailable");
  expect(ownerRow(missingHtml,entrant)).not.toContain("New to top 100");
  const collecting={...snapshot,firstDate:date,...compareHolderRankings(today,date,{})};
  const collectingHtml=render(1,false,10,collecting);
  expect(collectingHtml).toContain("Collecting history");
  expect(collectingHtml).toContain("Balance bar legend");
 });
 it("uses each period's balance and recalculates the selected rank view",()=>{
  expect(ownerRow(render(7),gain)).toContain("−1,500,000");
  expect(ownerRow(render(7),gain)).toContain("-37.50%");
  expect(ownerRow(render(30),gain)).toContain("+1,500,000");
  expect(ownerRow(render(30),gain)).toContain("+150.00%");
  const filtered=render(1,true,100);
  expect(filtered).not.toContain(`https://solscan.io/account/${custody}`);
  expect(filtered).toContain("Jump Crypto #2");
  expect(ownerRow(filtered,gain)).toContain("width:80%");
  expect(ownerRow(filtered,gain)).toContain("width:20%");
  expect(filtered).toContain("h-1.5");
  expect(filtered).toContain("Showing 99 of 99 owners after filtering");
  expect(ownerRow(filtered,gain)).toContain("Rank improved by 1");
  expect(ownerRow(filtered,gain)).toContain("+500,000");
  expect(render(1,false,50)).toContain("Showing 50 of 100 tracked owners");
 });
 it("exports a clearly marked interactive preview without modifying Convex",()=>{
  const variants:Record<string,string>={};
  for(const period of [1,7,30])for(const filtered of [false,true])for(const limit of [10,50,100])variants[`${period}-${filtered}-${limit}`]=render(period,filtered,limit);
  const cssDir=join(process.cwd(),".next/static/chunks");
  const css=(existsSync(cssDir) ? readdirSync(cssDir) : []).filter(name=>name.endsWith(".css")).map(name=>readFileSync(join(cssDir,name),"utf8")).join("\n");
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PYTH changes — synthetic preview</title><style>${css}\nbody{background:#21192f;color:white;font-family:Arial,sans-serif;margin:0;padding:24px}main{max-width:1000px;margin:auto}.demo{background:#483622;border:1px solid #d5ae55;padding:14px 20px;border-radius:12px;margin-bottom:20px;font-size:14px;line-height:1.6}</style></head><body><main><div class="demo"><strong>DEMO · ALL BALANCES AND CHANGES ARE SYNTHETIC</strong><br>No live data was changed. Gain: +500,000 PYTH; loss: −500,000 PYTH; unchanged: 0; smallest increase: +0.000001 PYTH; new entrant: unavailable previous balance. Change the period and custody filter below.</div><div id="preview">${variants["1-false-10"]}</div></main><script>const variants=${JSON.stringify(variants).replace(/</g,"\\u003c")};let days="1",filtered=false,limit="10";document.getElementById("preview").addEventListener("change",event=>{const target=event.target;if(target.type==="checkbox")filtered=target.checked;else if(target.options?.[0]?.value==="10")limit=target.value;else days=target.value;document.getElementById("preview").innerHTML=variants[days+"-"+filtered+"-"+limit];});</script></body></html>`;
  mkdirSync("reports",{recursive:true});
  writeFileSync("reports/pyth-holder-changes-demo.html",html);
  expect(html).toContain("ALL BALANCES AND CHANGES ARE SYNTHETIC");
 });
});
