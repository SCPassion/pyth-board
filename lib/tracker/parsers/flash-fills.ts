import type { Transaction, Program, ParseResult, Instruction } from "../types";
import { swapParser } from "./swap";
import { rawAmount } from "../helius-format";
/** Verified against Helius DCA Filled events and Jupiter's published DCA IDL.
 * Flash fill execution is a sibling of initiate/fulfill, not a child CPI. */
export function flashFills(
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
        p.product === "RECURRING" &&
        p.programId === event.programId,
    );
    if (!p || event.instructionName !== "Filled") continue;
    const d = event.args;
    const orderKey = typeof d.dca_key === "string" ? d.dca_key : null;
    const owner = typeof d.user_key === "string" ? d.user_key : null;
    const end = tx.instructions.find(
      (i) =>
        i.instructionIndex === event.instructionIndex &&
        i.innerInstructionIndex === null &&
        i.programId === p.programId &&
        i.instructionName === "fulfill_flash_fill" &&
        i.accounts.dca === orderKey,
    );
    const starts = tx.instructions.filter(
      (i) =>
        i.instructionIndex < event.instructionIndex &&
        i.innerInstructionIndex === null &&
        i.programId === p.programId &&
        i.instructionName === "initiate_flash_fill" &&
        i.accounts.dca === orderKey,
    );
    const start = starts.at(-1);
    if (!start || !end || !owner || !orderKey) {
      result.review.push("Unlinked Recurring fill event");
      continue;
    }
    const routes = tx.instructions.filter(
      (i) =>
        i.instructionIndex > start.instructionIndex &&
        i.instructionIndex < end.instructionIndex &&
        i.summary?.type === "swap" &&
        programs.some(
          (p) =>
            p.verified && p.product === "SWAP" && p.programId === i.programId,
        ),
    );
    // Without a unique route and matching keeper authority, do not consume a
    // coincidentally adjacent independent trade or claim an economic owner.
    if (
      routes.length !== 1 ||
      routes[0].accounts.user_transfer_authority !== start.accounts.keeper
    ) {
      result.review.push("Ambiguous Recurring flash-fill route");
      continue;
    }
    const route = routes[0];
    const rd = route.summary?.parsedData as Record<string, unknown> | undefined;
    if (rd?.input_mint !== d.input_mint || rd?.output_mint !== d.output_mint) {
      result.review.push("Recurring route and fill mint mismatch");
      continue;
    }
    result.consumed.add(route);
    try {
      const trade = swapParser(tx, {
        ...event,
        summary: {
          type: "swap",
          parsedData: {
            input_mint: d.input_mint,
            output_mint: d.output_mint,
            in_amount: rawAmount(d.in_amount),
            actual_out_amount: rawAmount(d.out_amount),
            inner_swaps: rd?.inner_swaps,
          },
        },
      });
      result.orders.push({
        orderKey,
        owner,
        product: "RECURRING",
        programId: p.programId,
        sourceSignature: tx.signature,
      });
      if (trade)
        result.trades.push({
          ...trade,
          product: "RECURRING",
          owner,
          ownerConfidence: "HIGH",
          orderKey,
          executionAuthority: start.accounts.keeper ?? null,
        });
    } catch (e) {
      result.review.push(
        e instanceof Error ? e.message : "Invalid Recurring fill",
      );
    }
  }
  return result;
}
