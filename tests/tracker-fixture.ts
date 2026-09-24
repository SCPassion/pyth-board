import { decodeHelius } from "../lib/tracker/helius-format";
import type { Transaction } from "../lib/tracker/types";

/** Keep a few provider envelopes for decoder coverage; use compact parser inputs elsewhere. */
export function fixtureTransaction(value: unknown): Transaction {
  return value && typeof value === "object" && "parsed" in value
    ? decodeHelius(value)
    : value as Transaction;
}
