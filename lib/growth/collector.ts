import { countPythHolders } from "./holders";
import { selectTopHolders } from "./holderExclusions";

const COLLECTION_TIMEOUT_MS = 480_000;
const MAX_PAGE_ATTEMPTS = 4;

class RpcFailure extends Error {
  constructor(message: string, readonly retryable: boolean, readonly retryAfterMs = 0) {
    super(message);
  }
}

function retryAfterMs(response: Response) {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1_000, 30_000) : 0;
}

export async function collectPythHolders(endpoint: string | undefined, fetcher: typeof fetch = fetch) {
  if (!endpoint) throw new Error("Missing PRIMARY_SOLANA_RPC_URL");
  const owners = new Map<string, bigint>();
  const cursors = new Set<string>();
  const startedAt = Date.now();
  let cursor: string | undefined;
  let totalTokenAccounts = 0, positiveTokenAccounts = 0, pages = 0, responseBytes = 0;
  do {
    let result;
    for (let attempt = 0; attempt < MAX_PAGE_ATTEMPTS; attempt++) {
      const remaining = COLLECTION_TIMEOUT_MS - (Date.now() - startedAt);
      if (remaining <= 0) throw new Error("PYTH collection timeout");
      try {
        const response = await fetcher(endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(Math.min(30_000, remaining)),
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getProgramAccountsV2", params: [
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", {
              encoding: "base64", commitment: "confirmed", limit: 10_000,
              filters: [{ memcmp: { offset: 0, bytes: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3" } }, { dataSize: 165 }],
              dataSlice: { offset: 32, length: 40 }, ...(cursor ? { paginationKey: cursor } : {}),
            },
          ] }),
        });
        if (!response.ok) throw new RpcFailure(`PYTH RPC HTTP ${response.status}`, response.status === 429 || response.status >= 500, retryAfterMs(response));
        const text = await response.text();
        responseBytes += Buffer.byteLength(text);
        let body;
        try { body = JSON.parse(text); } catch { throw new RpcFailure("PYTH RPC invalid JSON", false); }
        if (body?.error) {
          const code = Number.isSafeInteger(body.error.code) ? body.error.code as number : undefined;
          const permanent = code !== undefined && [-32700, -32600, -32601, -32602].includes(code);
          throw new RpcFailure(`PYTH RPC JSON-RPC error${code === undefined ? "" : ` (code ${code})`}`, !permanent);
        }
        result = body?.result;
        break;
      } catch (error) {
        const failure = error instanceof RpcFailure ? error : new RpcFailure("PYTH RPC network failure or timeout", true);
        if (!failure.retryable || attempt === MAX_PAGE_ATTEMPTS - 1) throw failure;
        const delay = Math.max(failure.retryAfterMs, 1_000 * 2 ** attempt);
        if (delay >= COLLECTION_TIMEOUT_MS - (Date.now() - startedAt)) throw new Error("PYTH collection timeout");
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    if (!result || !Array.isArray(result.accounts) ||
      !(result.paginationKey === null || (typeof result.paginationKey === "string" && result.paginationKey.length > 0))) {
      throw new Error("PYTH RPC malformed page or missing cursor");
    }
    const counts = countPythHolders(result.accounts, owners);
    totalTokenAccounts += counts.totalTokenAccounts;
    positiveTokenAccounts += counts.positiveTokenAccounts;
    pages++;
    cursor = result.paginationKey ?? undefined;
    if (cursor) {
      if (cursors.has(cursor)) throw new Error("PYTH RPC repeated cursor");
      cursors.add(cursor);
    }
  } while (cursor);
  if (owners.size === 0) throw new Error("PYTH collection has zero holders");
  const { topHolders, eligibleHolders } = selectTopHolders(owners);
  return { holders: owners.size, totalTokenAccounts, positiveTokenAccounts, pages, responseBytes,
    topHolders, eligibleHolders,
    startedAt, collectedAt: Date.now() };
}
