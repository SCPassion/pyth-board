import type { Instruction, Program, Transaction } from "../types";
import { routerFor } from "../routers/registry";
import { DIRECT_VENUES } from "../venues/registry";
import { hostFeeArbitrage } from "../routers/host-fee-arbitrage";
import type { ArbitrageExecution } from "../types";
import { verifiedWrapperCycle } from "../routers/wrapper-cycle";
import { PYTH_MINT } from "../config";

/** A decoded child swap does not establish an unknown parent's economic
 * boundary. Retain the whole top-level invocation for review, even when its
 * visible PYTH legs cancel. Never promote child routers into standalone trades. */
export function unsupportedExecutions(tx: Transaction, programs: Program[]) {
  const excluded = new Set<Instruction>();
  const review: string[] = [];
  const arbitrages: ArbitrageExecution[] = [];
  for (const root of tx.instructions) {
    if (root.innerInstructionIndex !== null) continue;
    if (
      programs.some((p) => p.verified && p.programId === root.programId) ||
      routerFor(root) ||
      DIRECT_VENUES.some((v) =>
        (v.programIds as readonly string[]).includes(root.programId),
      )
    )
      continue;
    const branch = tx.instructions.filter(
      (ix) => ix.instructionIndex === root.instructionIndex,
    );
    const hasSwap = branch.some((ix) => ix.summary?.type === "swap");
    // Some RFQ/fill formats expose mints and amounts but no swap summary.
    // This is only a review signal, never proof of execution or ownership.
    const mintPairExecution =
      ["fill", "fill_order", "swap", "swap_v2", "route"].includes(
        root.instructionName ?? "",
      ) &&
      root.accounts.input_mint &&
      root.accounts.output_mint &&
      root.accounts.input_mint !== root.accounts.output_mint &&
      [root.accounts.input_mint, root.accounts.output_mint].includes(PYTH_MINT);
    if (!hasSwap && !mintPairExecution) continue;
    const arbitrage = hostFeeArbitrage(tx, root, branch.slice(1));
    if (arbitrage) arbitrages.push(arbitrage);
    else if (!verifiedWrapperCycle(tx, root, branch.slice(1)))
      review.push(
        `Unsupported execution program ${root.programId} at ${root.instructionIndex}:top: ${hasSwap ? "decoded swap evidence" : "unverified mint-pair execution"} requires economic boundary review`,
      );
    for (const ix of branch) excluded.add(ix);
  }
  return { excluded, review, arbitrages };
}
