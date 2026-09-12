import { decodeStakeEntry, PYTH_EPOCH_SECONDS, STAKING_PROGRAM, STAKING_ENCODING } from "./governanceStakers";

export function requireHeliusEndpoint(endpoint: string | undefined): string {
  if (!endpoint) throw new Error("Missing PRIMARY_SOLANA_RPC_URL");
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error("Invalid Helius RPC configuration"); }
  if (url.protocol !== "https:" || url.hostname !== "mainnet.helius-rpc.com" || url.username || url.password) {
    throw new Error("PRIMARY_SOLANA_RPC_URL must use Helius mainnet RPC");
  }
  return endpoint;
}

type Options = {
  fetcher?: typeof fetch;
  now?: () => number;
  pageSize?: number;
  encoding?: "base64" | "base64+zstd";
  onAccount?: (data: Buffer, epoch: bigint, votingAmount: bigint) => void;
};

export async function collectGovernanceStakers(endpoint: string | undefined, options: Options = {}) {
  const url = requireHeliusEndpoint(endpoint);
  const { fetcher = fetch, now = Date.now, pageSize = STAKING_ENCODING === "base64+zstd" ? 5000 : 1000, encoding = STAKING_ENCODING, onAccount } = options;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 10000) throw new Error("Invalid page size");
  const startedAt = now();
  const date = new Date(startedAt).toISOString().slice(0, 10);
  let requests = 0, responseBytes = 0, pages = 0, totalStakeAccounts = 0, eligibleStakeAccounts = 0;
  const checkDeadline = () => {
    const remaining = 480_000 - (now() - startedAt);
    if (remaining <= 0) throw new Error("Governance collection deadline exceeded");
    return remaining;
  };
  async function rpc(method: string, params: unknown[]): Promise<unknown> {
    const remaining = checkDeadline();
    try {
      requests++;
      const response = await fetcher(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, redirect: "error",
        signal: AbortSignal.timeout(Math.min(30_000, remaining)),
        body: JSON.stringify({ jsonrpc: "2.0", id: requests, method, params }),
      });
      if (!response.ok) throw new Error(`Governance RPC HTTP ${response.status}`);
      const text = await response.text();
      responseBytes += Buffer.byteLength(text);
      let body;
      try { body = JSON.parse(text); } catch { throw new Error("Governance RPC invalid JSON"); }
      if (body?.error || !body || !("result" in body)) throw new Error("Governance RPC invalid result");
      checkDeadline();
      return body.result;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Governance")) throw error;
      throw new Error("Governance RPC network failure or timeout");
    }
  }
  async function chainEpoch() {
    // Solana Clock sysvar: unix_timestamp is i64 at byte 32. All reads use Helius.
    const result = await rpc("getAccountInfo", ["SysvarC1ock11111111111111111111111111111111", {
      encoding: "base64", commitment: "confirmed", dataSlice: { offset: 32, length: 8 },
    }]) as { value?: { data?: unknown } } | null;
    const encoded = result?.value?.data;
    if (!Array.isArray(encoded) || encoded.length !== 2 || encoded[1] !== "base64" || typeof encoded[0] !== "string") throw new Error("Governance RPC malformed clock");
    const data = Buffer.from(encoded[0], "base64");
    if (data.length !== 8 || data.toString("base64") !== encoded[0]) throw new Error("Governance RPC malformed clock");
    const seconds = data.readBigInt64LE();
    if (seconds <= 0n) throw new Error("Governance RPC invalid chain time");
    return { epoch: seconds / PYTH_EPOCH_SECONDS, day: seconds / 86400n };
  }
  const startClock = await chainEpoch();
  const owners = new Set<string>(), cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const result = await rpc("getProgramAccountsV2", [STAKING_PROGRAM, {
      encoding, commitment: "confirmed", limit: pageSize,
      filters: [{ memcmp: { offset: 0, bytes: "FM2r3wAdZaa" } }],
      ...(cursor ? { paginationKey: cursor } : {}),
    }]) as { accounts?: unknown; paginationKey?: unknown } | null;
    if (!result || !Array.isArray(result.accounts) ||
        !(result.paginationKey === null || (typeof result.paginationKey === "string" && result.paginationKey.length > 0))) {
      throw new Error("Governance RPC malformed page or missing cursor");
    }
    for (const entry of result.accounts) {
      const decoded = decodeStakeEntry(entry, startClock.epoch);
      onAccount?.(decoded.data, startClock.epoch, decoded.votingAmount);
      totalStakeAccounts++;
      if (decoded.votingAmount > 0n) { owners.add(decoded.owner); eligibleStakeAccounts++; }
    }
    checkDeadline();
    pages++;
    cursor = result.paginationKey ?? undefined;
    if (cursor) {
      if (cursors.has(cursor)) throw new Error("Governance RPC repeated cursor");
      cursors.add(cursor);
    }
  } while (cursor);
  const endClock = await chainEpoch();
  const collectedAt = now();
  if (endClock.epoch !== startClock.epoch) throw new Error("Governance scan crossed Pyth epoch");
  if (endClock.day !== startClock.day || new Date(collectedAt).toISOString().slice(0, 10) !== date) throw new Error("Governance scan crossed UTC midnight");
  if (owners.size === 0) throw new Error("Governance collection has zero stakers");
  return { stakers: owners.size, epoch: startClock.epoch.toString(), totalStakeAccounts, eligibleStakeAccounts,
    encoding, pageSize, pages, requests, responseBytes, startedAt, collectedAt };
}
