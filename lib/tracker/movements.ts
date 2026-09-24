import { PARSER_VERSION, PYTH_MINT } from "./config";
import { record } from "./helius-format";
import {
  normalizeTransaction,
  TOKEN_PROGRAM,
  type NormalizedTransaction,
} from "./normalize";

export type MovementAccounting = {
  signature: string;
  slot: number;
  blockTime: number;
  parserVersion: number;
  status: "RECONCILED" | "PARTIAL" | "UNAVAILABLE";
  issues: string[];
  balances: {
    tokenAccount: string;
    owner: string | null;
    preRaw: string | null;
    postRaw: string | null;
    deltaRaw: string | null;
  }[];
  transfers: {
    instructionIndex: number;
    innerInstructionIndex: number | null;
    source: string;
    destination: string;
    authority: string;
    amountRaw: string;
  }[];
};
/** Compatibility projection for stored v10 PYTH movement records. The shared
 * provider-independent normalizer owns account resolution and transfer decoding. */
export function projectPythMovements(
  n: NormalizedTransaction,
): MovementAccounting {
  const result: MovementAccounting = {
    signature: n.signature,
    slot: n.slot,
    blockTime: n.blockTime,
    parserVersion: PARSER_VERSION,
    status: "UNAVAILABLE",
    issues: [],
    balances: [],
    transfers: [],
  };
  if (n.status === "UNAVAILABLE") return { ...result, issues: n.issues };
  const states = n.tokenStates.filter((s) => s.mint === PYTH_MINT);
  if (states.some((s) => s.decimals !== 6 || s.tokenProgram !== TOKEN_PROGRAM))
    return { ...result, issues: ["Unsupported PYTH token metadata"] };
  result.balances = states.map((s) => ({
    tokenAccount: s.account,
    owner: s.owner,
    preRaw: s.preRaw,
    postRaw: s.postRaw,
    deltaRaw: s.deltaRaw,
  }));
  result.transfers = n.transfers
    .filter((t) => t.mint === PYTH_MINT)
    .map(({ mint, tokenProgram, ...t }) => t);
  result.issues = states.flatMap((s) =>
    s.issues.map((i) => i + ": " + s.account),
  );
  result.issues.push(
    ...n.issues.filter((i) => i === "Unattributed unchecked token transfer"),
  );
  if (!states.length) result.issues.push("No PYTH balance evidence");
  result.status = result.issues.length ? "PARTIAL" : "RECONCILED";
  return result;
}
export function accountPythMovements(
  payload: unknown,
  signature: string,
  finalizedSuccess: boolean,
): MovementAccounting {
  const envelope = record(payload);
  return projectPythMovements(
    normalizeTransaction(
      envelope.signature === signature ? envelope.rawTransaction : null,
      signature,
      finalizedSuccess,
    ),
  );
}
