import type { Instruction, Program } from "../types";
/** Unknown formats are evidence for review, not permission to invent a trade. */
export function fallbackReason(
  ix: Instruction,
  programs: Program[],
): string | null {
  if (programs.some((p) => p.verified && p.programId === ix.programId))
    return null;
  const candidate =
    programs.some((p) => p.programId === ix.programId) ||
    /jupiter|^dca$|^limit_order$/.test(ix.programName ?? "");
  if (!candidate) return null;
  // Known non-execution lifecycle names do not imply a missing swap.
  if (
    [
      "cancel_order",
      "create_order",
      "open_dca",
      "open_dca_v2",
      "close_dca",
      "withdraw",
      "deposit",
    ].includes(ix.instructionName ?? "")
  )
    return null;
  return `Unverified Jupiter program ${ix.programId} at ${ix.instructionIndex}:${ix.innerInstructionIndex ?? "top"}`;
}
