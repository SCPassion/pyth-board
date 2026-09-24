import { array, record, rawAmount } from "../helius-format";
import { PARSER_VERSION, PYTH_MINT, PYTH_DECIMALS } from "../config";
import type { Instruction, Trade, Transaction } from "../types";
export function swapParser(tx: Transaction, ix: Instruction): Trade | null {
  const s = ix.summary,
    d = record(s?.parsedData);
  if (s?.type !== "swap") throw new Error("No economic execution summary");
  const inputMint = d.input_mint,
    outputMint = d.output_mint;
  if (typeof inputMint !== "string" || typeof outputMint !== "string")
    throw new Error("Missing economic mints");
  if (
    inputMint === outputMint ||
    (inputMint !== PYTH_MINT && outputMint !== PYTH_MINT)
  )
    return null;
  const inputAmountRaw = rawAmount(d.in_amount),
    outputAmountRaw = rawAmount(d.actual_out_amount);
  if (BigInt(inputAmountRaw) <= 0n || BigInt(outputAmountRaw) <= 0n)
    throw new Error("Nonpositive execution amount");
  const side = inputMint === PYTH_MINT ? "SELL" : "BUY",
    counterMint = side === "BUY" ? inputMint : outputMint;
  const counterDecimals = tx.decimals[counterMint];
  if (
    counterDecimals === undefined ||
    (tx.decimals[PYTH_MINT] !== undefined &&
      tx.decimals[PYTH_MINT] !== PYTH_DECIMALS)
  )
    throw new Error("Missing or inconsistent mint decimals");
  return {
    router: "JUPITER",
    tradeId: `${tx.signature}:${ix.instructionIndex}:${ix.innerInstructionIndex ?? "top"}`,
    signature: tx.signature,
    slot: tx.slot,
    blockTime: tx.blockTime,
    side,
    inputMint,
    outputMint,
    inputAmountRaw,
    outputAmountRaw,
    pythAmountRaw: side === "BUY" ? outputAmountRaw : inputAmountRaw,
    counterMint,
    counterAmountRaw: side === "BUY" ? inputAmountRaw : outputAmountRaw,
    counterDecimals,
    product: "SWAP",
    owner: null,
    ownerConfidence: "UNRESOLVED",
    classificationConfidence: "HIGH",
    executionProgramId: ix.programId,
    executionAuthority: ix.accounts.user_transfer_authority ?? null,
    orderKey: null,
    routeLegs: array(d.inner_swaps)
      .map(record)
      .map((l) => {
        if (
          typeof l.input_mint !== "string" ||
          typeof l.output_mint !== "string"
        )
          throw new Error("Invalid route leg");
        return {
          inputMint: l.input_mint,
          outputMint: l.output_mint,
          inputAmountRaw: rawAmount(l.input_amount),
          outputAmountRaw: rawAmount(l.output_amount),
          dexProgramId:
            typeof l.amm_program_id === "string" && l.amm_program_id
              ? l.amm_program_id
              : null,
          dexName:
            typeof l.amm_program_name === "string" ? l.amm_program_name : null,
        };
      }),
    flags: [],
    parserVersion: PARSER_VERSION,
    usdValue: null,
    priceUsd: null,
    priceTimestamp: null,
    priceSource: null,
  };
}
