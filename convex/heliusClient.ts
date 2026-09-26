/** Server-only provider boundary. Never import this module into client components. */
import { PARSED_COALESCE_MS } from "../lib/tracker/config";
export const PARSED_BATCH_SIZE = 50;
export { PARSED_COALESCE_MS };
export class ProviderError extends Error {
  constructor(
    message: string,
    public transient: boolean,
  ) {
    super(message);
  }
}
export class HeliusClient {
  private key: string;
  readonly usage = {
    parsedRequests: 0, parsedSignatures: 0,
    primaryParsedRequests: 0, attributionParsedRequests: 0,
    statusRequests: 0, rawRequests: 0, historyRequests: 0,
  };
  constructor() {
    this.key = process.env.HELIUS_API_KEY ?? "";
    if (!this.key)
      throw new ProviderError("HELIUS_API_KEY is not configured", false);
  }
  private async request(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(
        `https://mainnet.helius-rpc.com${path}?api-key=${encodeURIComponent(this.key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        },
      );
    } catch {
      throw new ProviderError("Helius request timed out or failed", true);
    }
    if (!response.ok)
      throw new ProviderError(
        `Helius HTTP ${response.status}`,
        response.status === 429 || response.status >= 500,
      );
    try {
      return await response.json();
    } catch {
      throw new ProviderError("Helius returned invalid JSON", true);
    }
  }
  async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const value = await this.request("/", {
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    });
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ProviderError("Invalid Helius RPC envelope", true);
    const j = value as { result: T; error?: { code: number } };
    if (j.error) {
      if (!Number.isSafeInteger(j.error.code))
        throw new ProviderError("Invalid Helius RPC error", true);
      throw new ProviderError(
        `Helius RPC error ${j.error.code}`,
        j.error.code === -32005,
      );
    }
    if (!Object.prototype.hasOwnProperty.call(j, "result"))
      throw new ProviderError("Missing Helius RPC result", true);
    return j.result;
  }
  async parsed(signature: string, purpose: "PRIMARY" | "ATTRIBUTION" = "PRIMARY"): Promise<unknown> {
    return (await this.parsedMany([signature], purpose)).get(signature);
  }
  async parsedMany(signatures: string[], purpose: "PRIMARY" | "ATTRIBUTION" = "PRIMARY"): Promise<Map<string, unknown>> {
    if (!signatures.length || signatures.length > PARSED_BATCH_SIZE || new Set(signatures).size !== signatures.length)
      throw new ProviderError("Invalid Parsed Events batch", false);
    this.usage.parsedRequests++;
    this.usage.parsedSignatures += signatures.length;
    if (purpose === "ATTRIBUTION") this.usage.attributionParsedRequests++;
    else this.usage.primaryParsedRequests++;
    const j = await this.request("/v1/parsed-events/transactions", {
      transactions: signatures,
      includeRawTransaction: true,
    });
    if (!Array.isArray(j) || j.length !== signatures.length)
      throw new ProviderError("Unexpected Parsed Events envelope", false);
    const requested = new Set(signatures);
    const result = new Map<string, unknown>();
    for (const item of j) {
      const signature = item && typeof item === "object" && !Array.isArray(item)
        ? (item as { signature?: unknown }).signature : null;
      if (typeof signature !== "string" || !requested.has(signature) || result.has(signature))
        throw new ProviderError("Unexpected Parsed Events identity", false);
      result.set(signature, item);
    }
    return result;
  }
  async raw(signature: string) {
    this.usage.rawRequests++;
    return this.rpc<unknown>("getTransaction", [
      signature,
      {
        encoding: "json",
        maxSupportedTransactionVersion: 1,
        commitment: "finalized",
      },
    ]);
  }
  async finalized(signature: string) {
    this.usage.statusRequests++;
    const r = await this.rpc<{
      value: ({ confirmationStatus: string; err: unknown } | null)[];
    }>("getSignatureStatuses", [
      [signature],
      { searchTransactionHistory: true },
    ]);
    if (!r || !Array.isArray(r.value) || r.value.length !== 1)
      throw new ProviderError("Invalid finalization response", true);
    const s = r.value[0];
    if (!s || s.confirmationStatus !== "finalized")
      throw new ProviderError("Awaiting finalized transaction", true);
    if (!Object.prototype.hasOwnProperty.call(s, "err"))
      throw new ProviderError("Missing execution status", true);
    return s.err === null;
  }
  async history(address: string, before: string | null) {
    this.usage.historyRequests++;
    return this.rpc<
      {
        signature: string;
        slot: number;
        blockTime: number | null;
        err: unknown;
      }[]
    >("getSignaturesForAddress", [
      address,
      { limit: 100, commitment: "finalized", ...(before ? { before } : {}) },
    ]);
  }
  /** Raw RPC is authoritative; enhanced parsing is optional enrichment. */
  async evidence(signature: string): Promise<unknown> {
    const rawTransaction = await this.rawEvidence(signature);
    try {
      const parsed = await this.parsed(signature);
      return this.combineEvidence(signature, rawTransaction, parsed);
    } catch {
      return { signature, rawTransaction, parserStatus: "UNAVAILABLE" };
    }
  }
  async rawEvidence(signature: string): Promise<unknown> {
    const rawTransaction = await this.raw(signature);
    if (!rawTransaction)
      throw new ProviderError("Finalized raw transaction unavailable", true);
    const raw = rawTransaction as {
      transaction?: { signatures?: unknown[] };
      meta?: { err?: unknown };
    };
    if (
      raw.transaction?.signatures?.[0] !== signature ||
      !raw.meta ||
      !Object.prototype.hasOwnProperty.call(raw.meta, "err")
    )
      throw new ProviderError("Invalid raw transaction identity or status", true);
    return rawTransaction;
  }
  /** A transaction returned at finalized commitment already carries its execution result. */
  succeeded(rawTransaction: unknown): boolean {
    const meta = (rawTransaction as { meta?: { err?: unknown } } | null)?.meta;
    if (!meta || !Object.prototype.hasOwnProperty.call(meta, "err"))
      throw new ProviderError("Missing finalized raw execution status", true);
    return meta.err === null;
  }
  combineEvidence(signature: string, rawTransaction: unknown, parsed: unknown): unknown {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
        (parsed as { signature?: string }).signature !== signature)
      return { signature, rawTransaction, parserStatus: "UNAVAILABLE" };
    return { ...parsed, rawTransaction };
  }
}
