/** Read-only verification of listed wallets using fresh RPC data and the Pyth SDK. */
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { Connection, PublicKey } from "@solana/web3.js";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

process.loadEnvFile(".env.local");
const endpoint = process.env.PRIMARY_SOLANA_RPC_URL;
if (!endpoint || !process.env.NEXT_PUBLIC_CONVEX_URL) throw Error("Missing RPC or Convex configuration");
const { PythStakingClient, deserializeStakeAccountPositions, summarizeAccountPositions, PositionState } = createRequire(import.meta.url)("@pythnetwork/staking-sdk");
const sdk = new PythStakingClient({ connection: new Connection(endpoint), wallet: {
  publicKey: PublicKey.default,
  signTransaction: async () => { throw Error("Read only"); },
  signAllTransactions: async () => { throw Error("Read only"); },
} });
const program = sdk.stakingProgram.programId.toBase58();
let requestId = 0;
async function rpc(method, params) {
  const response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    signal: AbortSignal.timeout(30000), redirect: "error",
  });
  if (!response.ok) throw Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error || !("result" in body)) throw Error("RPC rejected verification request");
  return body.result;
}
async function epoch() {
  const clock = await rpc("getAccountInfo", ["SysvarC1ock11111111111111111111111111111111", {
    encoding: "base64", commitment: "confirmed", dataSlice: { offset: 32, length: 8 },
  }]);
  return Buffer.from(clock.value.data[0], "base64").readBigInt64LE() / 604800n;
}
const snapshot = await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL).query(anyApi.pythGovernanceStakers.leaderboard, {});
if (!snapshot) throw Error("No leaderboard to verify");
const startEpoch = await epoch();
const owners = [...new Set([...snapshot.topStakers, ...snapshot.topUnstaking].map(row => row.owner))];
const wallets = [];
for (const owner of owners) {
  // Fetch only PositionData accounts belonging to this owner, including every stake account.
  const result = await rpc("getProgramAccounts", [program, {
    encoding: "base64", commitment: "confirmed", withContext: true,
    filters: [{ memcmp: { offset: 0, bytes: "FM2r3wAdZaa" } }, { memcmp: { offset: 8, bytes: owner } }],
  }]);
  if (!Array.isArray(result.value)) throw Error("Incomplete account response");
  let staked = 0n, unstaking = 0n;
  for (const account of result.value) {
    if (account.account.owner !== program || account.account.data[1] !== "base64") throw Error("Unexpected staking account");
    const decoded = deserializeStakeAccountPositions(new PublicKey(account.pubkey), Buffer.from(account.account.data[0], "base64"), sdk.stakingProgram.idl);
    if (decoded.data.owner.toBase58() !== owner) throw Error("Owner mismatch");
    const summary = summarizeAccountPositions(decoded, startEpoch).voting;
    staked += summary[PositionState.LOCKED] + summary[PositionState.PREUNLOCKING];
    unstaking += summary[PositionState.PREUNLOCKING] + summary[PositionState.UNLOCKING];
  }
  wallets.push({ owner, stakeAccounts: result.value.length, slot: result.context.slot, staked: staked.toString(), unstaking: unstaking.toString() });
}
if (await epoch() !== startEpoch) throw Error("Verification crossed an epoch; rerun");
const comparisons = [
  ...snapshot.topStakers.map((row, i) => ({ list: "stakers", rank: i + 1, ...row, current: wallets.find(w => w.owner === row.owner).staked })),
  ...snapshot.topUnstaking.map((row, i) => ({ list: "unstaking", rank: i + 1, ...row, current: wallets.find(w => w.owner === row.owner).unstaking })),
].map(row => ({ ...row, matches: row.amount === row.current, delta: (BigInt(row.current) - BigInt(row.amount)).toString() }));
const report = {
  checkedAt: new Date().toISOString(), snapshotAt: new Date(snapshot.collectedAt).toISOString(),
  program, snapshotEpoch: snapshot.epoch, verificationEpoch: startEpoch.toString(),
  method: "Owner-filtered getProgramAccounts; Pyth SDK deserializeStakeAccountPositions and summarizeAccountPositions. Raw amounts use six decimals.",
  matchedEntries: comparisons.filter(row => row.matches).length, totalEntries: comparisons.length,
  wallets, comparisons,
};
const path = "reports/governance-leaderboard-verification.json";
await writeFile(path, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ report: path, matchedEntries: report.matchedEntries, totalEntries: report.totalEntries, uniqueWallets: owners.length, snapshotAt: report.snapshotAt, checkedAt: report.checkedAt, sameEpoch: snapshot.epoch === startEpoch.toString(), differences: comparisons.filter(row => !row.matches) }, null, 2));
