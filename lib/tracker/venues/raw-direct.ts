import { PYTH_MINT } from "../config";
import { array, record } from "../helius-format";
import { instructionBytes } from "../normalize";
import type { StateAnalysis } from "../state-analysis";
import type { Program, Trade } from "../types";
import { DIRECT_VENUES } from "./registry";

/** Skip enhanced parsing only for a fully reconciled, single direct pool swap. */
export function rawDirectVenueTrade(
  rawTransaction: unknown,
  analysis: StateAnalysis,
  programs: Program[],
): Trade | null {
  const n = analysis.normalized;
  if (
    n.status !== "RECONCILED" ||
    analysis.movementAccounting.status !== "RECONCILED" ||
    analysis.confirmedTrades.length !== 1 ||
    analysis.economic.domains.filter((d) => d.eventType === "SWAP").length !== 1
  ) return null;
  const trade = analysis.confirmedTrades[0];
  if (
    !trade.flags.includes("RAW_INDEPENDENT_POOL_EXECUTION") ||
    !trade.owner ||
    trade.orderKey ||
    n.transfers.filter((t) => t.mint === PYTH_MINT).length !== 1
  ) return null;
  const rootIndex = Number(trade.tradeId.split(":")[1]);
  const roots = n.instructions.filter((i) => i.innerInstructionIndex === null);
  const root = roots.find((i) => i.instructionIndex === rootIndex);
  const venue = DIRECT_VENUES.find((v) => v.programIds.includes(root?.programId ?? ""));
  if (!root || !venue || !root.accounts.includes(trade.owner)) return null;
  if (
    n.instructions.some((i) => programs.some((p) => p.programId === i.programId)) ||
    roots.filter((i) => DIRECT_VENUES.some((v) => v.programIds.includes(i.programId))).length !== 1 ||
    new Set(n.transfers.filter((t) => t.mint === PYTH_MINT).map((t) => t.instructionIndex)).size !== 1 ||
    !n.transfers.filter((t) => t.mint === PYTH_MINT).every((t) => t.instructionIndex === rootIndex)
  ) return null;
  try {
    const raw = record(rawTransaction);
    const instructions = array(record(record(raw.transaction).message).instructions);
    const bytes = instructionBytes(record(instructions[rootIndex]).data);
    const discriminator = bytes.slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (
      (venue.id === "RAYDIUM_CLMM" && discriminator !== "2b04ed0b1ac91e62") ||
      (venue.id === "ORCA_WHIRLPOOL" && !["f8c69e91e17587c8", "2b04ed0b1ac91e62"].includes(discriminator))
    ) return null;
  } catch {
    return null;
  }
  return {
    ...trade,
    tradeId: `${n.signature}:${rootIndex}:top`,
    router: venue.id,
    ownerConfidence: "MEDIUM",
    flags: ["DIRECT_VENUE_EXECUTION"],
  };
}
