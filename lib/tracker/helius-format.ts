import type { Transaction, Instruction } from "./types";
export function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
export function array(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
export function rawAmount(v: unknown): string {
  if (typeof v === "string" && /^\d+$/.test(v) && v.length <= 40)
    return BigInt(v).toString();
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0)
    return String(v);
  throw new Error("Missing or unsafe raw integer");
}
export function decodeHelius(value: unknown): Transaction {
  const envelope = record(value),
    p = record(envelope.parsed);
  if (envelope.parserStatus !== "OK")
    throw new Error("Provider could not decode transaction");
  if (
    typeof envelope.signature !== "string" ||
    !Number.isSafeInteger(p.slot) ||
    typeof p.blockTime !== "number" ||
    !Number.isSafeInteger(p.blockTime) ||
    Number(p.slot) < 0 ||
    p.blockTime <= 0
  )
    throw new Error("Missing transaction identity/time");
  if (p.transactionStatus !== "OK" && p.transactionStatus !== "ERROR")
    throw new Error("Missing execution status");
  const decimals: Record<string, number> = {};
  for (const t of array(p.tokenTransfers).map(record))
    if (
      typeof t.mint === "string" &&
      Number.isInteger(t.decimals) &&
      Number(t.decimals) >= 0 &&
      Number(t.decimals) <= 18
    ) {
      if (decimals[t.mint] !== undefined && decimals[t.mint] !== t.decimals)
        throw new Error("Conflicting token decimals");
      decimals[t.mint] = Number(t.decimals);
    }
  const instructions: Instruction[] = array(p.instructions)
    .map(record)
    .map((ix) => {
      if (
        !Number.isSafeInteger(ix.instructionIndex) ||
        Number(ix.instructionIndex) < 0 ||
        typeof ix.programId !== "string"
      )
        throw new Error("Invalid instruction position");
      const d = record(ix.decoded),
        accounts: Record<string, string> = {};
      for (const a of array(d.accounts).map(record))
        if (typeof a.name === "string" && typeof a.pubkey === "string")
          accounts[a.name] = a.pubkey;
      return {
        instructionIndex: Number(ix.instructionIndex),
        innerInstructionIndex:
          typeof ix.innerInstructionIndex === "number"
            ? ix.innerInstructionIndex
            : null,
        stackHeight: typeof ix.stackHeight === "number" ? ix.stackHeight : null,
        programId: ix.programId,
        ...(typeof ix.programName === "string"
          ? { programName: ix.programName }
          : {}),
        instructionName:
          typeof ix.instructionName === "string" ? ix.instructionName : null,
        accounts,
        summary: ix.summary ? record(ix.summary) : null,
        args: record(d.args),
      };
    });
  return {
    signature: envelope.signature,
    slot: Number(p.slot),
    blockTime: p.blockTime * 1000,
    success: p.transactionStatus === "OK",
    instructions,
    decimals,
  };
}
