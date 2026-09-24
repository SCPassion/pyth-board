import { mergeConfirmedExchange } from "../semantics/pool-exchange";
import { decodeHelius } from "../helius-format";
import { analyzeRawEvidence } from "../state-analysis";
import type { StateAnalysis } from "../state-analysis";
import { directVenueExecutions } from "../venues/execution";
import { genericRouters } from "../routers/execution";
import { applyRouterScope } from "../routers/scope";
import { fallbackReason } from "./fallback";
import { flashFills } from "./flash-fills";
import { unsupportedExecutions } from "./unsupported";
import type {
  Transaction,
  Program,
  ParseResult,
  OrderLink,
  Instruction,
} from "../types";
import { swapParser } from "./swap";
import { recurringParser } from "./recurring";
import { triggerParser, triggerFills } from "./trigger";
export function parseTransaction(
  tx: Transaction,
  programs: Program[],
  knownOrders: OrderLink[] = [],
): ParseResult {
  const result: ParseResult = { trades: [], orders: [], review: [] };
  if (!tx.success) return result;
  const unsupported = unsupportedExecutions(tx, programs);
  result.review.push(...unsupported.review);
  if (unsupported.arbitrages.length) result.arbitrages = unsupported.arbitrages;
  tx = {
    ...tx,
    instructions: tx.instructions.filter((ix) => !unsupported.excluded.has(ix)),
  };
  const direct = directVenueExecutions(tx);
  result.trades.push(...direct.trades);
  result.review.push(...direct.review);
  const flash = flashFills(tx, programs);
  const trigger = triggerFills(tx, programs);
  flash.trades.push(...trigger.trades);
  flash.orders.push(...trigger.orders);
  flash.review.push(...trigger.review);
  for (const ix of trigger.consumed) flash.consumed.add(ix);
  const generic = genericRouters(tx, undefined, flash.consumed);
  result.trades.push(...flash.trades, ...generic.trades);
  result.review.push(...generic.review);
  for (const ix of generic.consumed) flash.consumed.add(ix);
  result.orders.push(...flash.orders);
  result.review.push(...flash.review);
  const registry = new Map(
    programs.filter((p) => p.verified).map((p) => [p.programId, p]),
  );
  const stack: Instruction[] = [];
  for (const ix of tx.instructions) {
    const unknown = generic.consumed.has(ix)
      ? null
      : fallbackReason(ix, programs);
    if (unknown) result.review.push(unknown);
    const height = ix.innerInstructionIndex === null ? 1 : ix.stackHeight;
    if (height !== null)
      while (stack.length && (stack.at(-1)!.stackHeight ?? 1) >= height)
        stack.pop();
    else stack.length = 0; // Unknown ancestry must never produce direct-owner attribution.
    const program = registry.get(ix.programId);
    const parent = [...stack]
      .reverse()
      .find((p) =>
        ["RECURRING", "TRIGGER"].includes(
          registry.get(p.programId)?.product ?? "",
        ),
      );
    if (
      program &&
      ix.instructionName &&
      program.ownerRole &&
      program.orderRole
    ) {
      const owner = ix.accounts[program.ownerRole],
        orderKey = ix.accounts[program.orderRole];
      if (owner && orderKey)
        result.orders.push({
          owner,
          orderKey,
          programId: program.programId,
          product: program.product,
          sourceSignature: tx.signature,
        });
    }
    if (flash.consumed.has(ix)) {
      stack.push(ix);
      continue;
    }
    if (program && ix.summary?.type === "swap") {
      try {
        let trade = swapParser(tx, ix);
        if (trade) {
          // An outer product summary consumes its child router summaries only when it
          // has a complete economic execution. Sibling executions remain independent.
          if (
            stack.some((p) =>
              result.trades.some(
                (t) =>
                  t.tradeId ===
                  `${tx.signature}:${p.instructionIndex}:${p.innerInstructionIndex ?? "top"}`,
              ),
            )
          ) {
            stack.push(ix);
            continue;
          }
          const productIx = program.product === "SWAP" ? parent : ix;
          const productProgram = productIx
            ? registry.get(productIx.programId)
            : undefined;
          if (productProgram?.product === "RECURRING")
            trade = recurringParser(trade, productIx!, productProgram, [
              ...knownOrders,
              ...result.orders,
            ]);
          else if (productProgram?.product === "TRIGGER")
            trade = triggerParser(trade, productIx!, productProgram, [
              ...knownOrders,
              ...result.orders,
            ]);
          else if (
            ix.innerInstructionIndex === null &&
            program.product === "SWAP" &&
            !tx.instructions.some(
              (i) =>
                registry.get(i.programId)?.product === "RECURRING" ||
                registry.get(i.programId)?.product === "TRIGGER",
            )
          ) {
            trade.owner = ix.accounts.user_transfer_authority ?? null;
            trade.ownerConfidence = trade.owner ? "HIGH" : "UNRESOLVED";
          } else trade.product = "UNKNOWN_JUPITER";
          if (!trade.owner) trade.flags.push("OWNER_UNRESOLVED");
          result.trades.push(trade);
        }
      } catch (e) {
        result.review.push(
          `${ix.instructionIndex}:${ix.innerInstructionIndex ?? "top"}: ${e instanceof Error ? e.message : "Unrecognized execution"}`,
        );
      }
    } else if (
      program &&
      ix.instructionName &&
      program.instructionNames.includes(ix.instructionName)
    ) {
      // A known execution instruction without a summary needs raw evidence review.
      if (program.product === "SWAP")
        result.review.push(
          `Missing swap summary at ${ix.instructionIndex}:${ix.innerInstructionIndex ?? "top"}`,
        );
    }
    stack.push(ix);
  }
  return applyRouterScope(result);
}

/** Preserve raw accounting even when the provider cannot decode economic instructions. */
export function parseEvidence(
  payload: unknown,
  signature: string,
  finalizedSuccess: boolean,
  programs: Program[],
): ParseResult {
  const stateAnalysis = analyzeRawEvidence(
    payload,
    signature,
    finalizedSuccess,
  );
  let result: ParseResult;
  try {
    const tx = decodeHelius(payload);
    if (tx.signature !== signature) throw new Error("Signature mismatch");
    tx.success = tx.success && finalizedSuccess;
    result = parseTransaction(tx, programs);
  } catch (e) {
    result = {
      trades: [],
      orders: [],
      review: [e instanceof Error ? e.message : "Decode failed"],
    };
  }
  return completeEvidence(result, stateAnalysis);
}

/** Keep raw-state merging and release scope identical in live and offline paths. */
export function completeEvidence(
  result: ParseResult,
  stateAnalysis: StateAnalysis,
): ParseResult {
  result = mergeConfirmedExchange(result, stateAnalysis.confirmedTrades, stateAnalysis.exclusions);
  result.stateAnalysis = stateAnalysis;
  result.movementAccounting = stateAnalysis.movementAccounting;
  return applyRouterScope(result);
}
