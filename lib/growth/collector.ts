import { countPythHolders } from "./holders";

export async function collectPythHolders(endpoint: string | undefined, fetcher: typeof fetch = fetch) {
  if (!endpoint) throw new Error("Missing PRIMARY_SOLANA_RPC_URL");
  const owners = new Set<string>();
  const cursors = new Set<string>();
  const startedAt = Date.now();
  let cursor: string | undefined;
  let totalTokenAccounts = 0, positiveTokenAccounts = 0, pages = 0, responseBytes = 0;
  do {
    const remaining = 480_000 - (Date.now() - startedAt);
    if (remaining <= 0) throw new Error("PYTH collection timeout");
    let result;
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
      if (!response.ok) throw new Error(`PYTH RPC HTTP ${response.status}`);
      const text = await response.text();
      responseBytes += Buffer.byteLength(text);
      let body;
      try { body = JSON.parse(text); } catch { throw new Error("PYTH RPC invalid JSON"); }
      if (body?.error) throw new Error("PYTH RPC JSON-RPC error");
      result = body?.result;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("PYTH RPC")) throw error;
      throw new Error("PYTH RPC network failure or timeout");
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
  return { holders: owners.size, totalTokenAccounts, positiveTokenAccounts, pages, responseBytes,
    startedAt, collectedAt: Date.now() };
}
