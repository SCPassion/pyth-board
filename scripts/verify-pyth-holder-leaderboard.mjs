/** Read-only balance checks against owner-filtered RPC, independent of the paginated scan. */
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { mkdir, writeFile } from "node:fs/promises";
process.loadEnvFile(".env.local");
const endpoint = process.env.PRIMARY_SOLANA_RPC_URL;
if (!endpoint || !process.env.NEXT_PUBLIC_CONVEX_URL) throw Error("Missing RPC or Convex configuration");
const limit = Number(process.argv[2] ?? 10);
if (![10,50,100].includes(limit)) throw Error("Choose 10, 50 or 100 wallets");
const snapshot = await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL).query(anyApi.pythHolderRankings.latest, {});
if (!snapshot) throw Error("No holder ranking to verify");
const comparisons = [];
for (const row of snapshot.entries.slice(0, limit)) {
  let response;
  for (let attempt = 0; attempt < 4; attempt++) {
  response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000), redirect: "error",
    body: JSON.stringify({ jsonrpc: "2.0", id: row.rank, method: "getTokenAccountsByOwner", params: [row.owner,
      { mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3" }, { encoding: "jsonParsed", commitment: "confirmed" }] }),
  });
  if (response.status !== 429) break;
  await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  if (!response.ok) throw Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error || !Array.isArray(body.result?.value)) throw Error("RPC rejected balance verification");
  let amount = 0n;
  for (const account of body.result.value) {
    const info = account.account.data.parsed.info;
    if (info.owner !== row.owner || info.mint !== "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3" || info.tokenAmount.decimals !== 6) throw Error("Unexpected token account");
    amount += BigInt(info.tokenAmount.amount);
  }
  await new Promise(resolve => setTimeout(resolve, 250));
  comparisons.push({owner:row.owner,rank:row.rank,snapshotAmount:row.amount,currentAmount:amount.toString(),delta:(amount-BigInt(row.amount)).toString(),matches:amount.toString()===row.amount,slot:body.result.context.slot});
}
const report={snapshotAt:new Date(snapshot.collectedAt).toISOString(),checkedAt:new Date().toISOString(),method:"getTokenAccountsByOwner; sum raw native PYTH amounts per owner",comparisons};
await mkdir("reports", {recursive:true});
await writeFile("reports/pyth-holder-leaderboard-verification.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({checked:comparisons.length,matched:comparisons.filter(row=>row.matches).length,snapshotAt:report.snapshotAt,differences:comparisons.filter(row=>!row.matches),report:"reports/pyth-holder-leaderboard-verification.json"},null,2));
