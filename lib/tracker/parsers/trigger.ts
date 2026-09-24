import { recurringParser } from "./recurring";
import type { Instruction, OrderLink, Program, Trade } from "../types";
export function triggerParser(
  trade: Trade,
  parent: Instruction,
  program: Program,
  orders: OrderLink[],
): Trade {
  return {
    ...recurringParser(trade, parent, program, orders),
    product: "TRIGGER",
  };
}

import type { Transaction, ParseResult } from "../types";
import { swapParser } from "./swap";
/** TradeEvent amounts are actual maker fill amounts, not route slippage limits. */
export function triggerFills(
  tx: Transaction,
  programs: Program[],
): ParseResult & { consumed: Set<Instruction> } {
  const result: ParseResult & { consumed: Set<Instruction> } = {
    trades: [],
    orders: [],
    review: [],
    consumed: new Set(),
  };
  for (const event of tx.instructions) {
    const p = programs.find(
      (p) =>
        p.verified &&
        p.product === "TRIGGER" &&
        p.programId === event.programId,
    );
    if (!p || event.instructionName !== "TradeEvent") continue;
    const d = event.args;
    const parent = tx.instructions.find(
      (i) =>
        i.programId === p.programId &&
        i.instructionIndex === event.instructionIndex &&
        i.innerInstructionIndex === null &&
        i.instructionName === "fill_order",
    );
    if (
      !parent ||
      parent.accounts.order !== d.order_key ||
      parent.accounts.taker !== d.taker
    ) {
      result.review.push("Unlinked Trigger fill event");
      continue;
    }
    const routes = tx.instructions.filter(
      (i) =>
        i.instructionIndex === parent.instructionIndex &&
        i.summary?.type === "swap" &&
        programs.some(
          (p) =>
            p.verified && p.product === "SWAP" && p.programId === i.programId,
        ),
    );
    if (routes.length !== 1) {
      result.review.push("Ambiguous Trigger route");
      continue;
    }
    const route = routes[0];
    const rd = route.summary?.parsedData as Record<string, unknown> | undefined;
    if (
      !rd ||
      rd.input_mint !== parent.accounts.input_mint ||
      rd.output_mint !== parent.accounts.output_mint
    ) {
      result.review.push("Trigger fill mint mismatch");
      continue;
    }
    result.consumed.add(route);
    try {
      const trade = swapParser(tx, {
        ...event,
        summary: {
          type: "swap",
          parsedData: {
            input_mint: parent.accounts.input_mint,
            output_mint: parent.accounts.output_mint,
            in_amount: d.making_amount,
            actual_out_amount: d.taking_amount,
            inner_swaps: rd.inner_swaps,
          },
        },
      });
      const owner = parent.accounts.maker ?? null,
        orderKey = parent.accounts.order ?? null;
      if (owner && orderKey)
        result.orders.push({
          owner,
          orderKey,
          product: "TRIGGER",
          programId: p.programId,
          sourceSignature: tx.signature,
        });
      if (trade)
        result.trades.push({
          ...trade,
          product: "TRIGGER",
          owner,
          orderKey,
          ownerConfidence: owner ? "HIGH" : "UNRESOLVED",
          executionAuthority: parent.accounts.taker ?? null,
          flags: owner ? [] : ["OWNER_UNRESOLVED"],
        });
    } catch (e) {
      result.review.push(
        e instanceof Error ? e.message : "Invalid Trigger fill",
      );
    }
  }
  return result;
}
