import type { Connection } from "@solana/web3.js";

const BATCH_SIZE = 5;
const BATCH_INTERVAL_MS = 1_000;
const MAX_RATE_LIMIT_RETRIES = 3;

function isRateLimit(error: unknown) {
  return error instanceof Error && /429|too many requests|rate limit/i.test(error.message);
}

/** Keep catch-up runs below common RPC per-method limits without skipping signatures. */
export async function fetchBuybackTransactions(
  connection: Pick<Connection, "getParsedTransactions">,
  signatures: string[],
  pause: (ms: number) => Promise<unknown> = ms => new Promise(resolve => setTimeout(resolve, ms)),
) {
  const transactions: Awaited<ReturnType<Connection["getParsedTransactions"]>> = [];
  for (let offset = 0; offset < signatures.length; offset += BATCH_SIZE) {
    if (offset > 0) await pause(BATCH_INTERVAL_MS);
    const batch = signatures.slice(offset, offset + BATCH_SIZE);
    for (let attempt = 0; ; attempt++) {
      try {
        transactions.push(...await connection.getParsedTransactions(batch, { maxSupportedTransactionVersion: 0 }));
        break;
      } catch (error) {
        if (!isRateLimit(error) || attempt >= MAX_RATE_LIMIT_RETRIES) throw error;
        await pause(2_000 * 2 ** attempt);
      }
    }
  }
  return transactions;
}
