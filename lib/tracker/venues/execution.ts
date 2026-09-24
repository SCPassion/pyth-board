import type { Transaction, Trade } from "../types";
import { swapParser } from "../parsers/swap";
import { DIRECT_VENUES } from "./registry";

/** Only top-level executions are direct. CPI pool legs belong to their parent
 * router/order, including unknown parents; emitting them would double count or
 * turn an intermediate token into an economic endpoint. */
export function directVenueExecutions(tx: Transaction, venues = DIRECT_VENUES) {
  const trades: Trade[] = [],
    review: string[] = [];
  if (!tx.success) return { trades, review };
  for (const ix of tx.instructions) {
    if (ix.innerInstructionIndex !== null) continue;
    const venue = venues.find((v) =>
      (v.programIds as readonly string[]).includes(ix.programId),
    );
    if (!venue) continue;
    if (
      !(venue.instructions as readonly string[]).includes(
        ix.instructionName ?? "",
      )
    ) {
      if (ix.summary?.type === "swap")
        review.push(venue.id + ": unsupported swap instruction");
      continue;
    }
    try {
      const trade = swapParser(tx, ix);
      if (!trade) continue;
      trade.router = venue.id; // Existing persisted source field; compatible with queries/UI.
      const owners = [
        ...new Set(
          venue.ownerRoles.flatMap((role) =>
            ix.accounts[role] ? [ix.accounts[role]] : [],
          ),
        ),
      ];
      trade.owner = owners.length === 1 ? owners[0] : null;
      trade.ownerConfidence = trade.owner ? "MEDIUM" : "UNRESOLVED";
      trade.executionAuthority = trade.owner;
      if (!trade.owner) trade.flags.push("OWNER_UNRESOLVED");
      trade.flags.push("DIRECT_VENUE_EXECUTION");
      if (!trade.routeLegs.length)
        trade.routeLegs.push({
          inputMint: trade.inputMint,
          outputMint: trade.outputMint,
          inputAmountRaw: trade.inputAmountRaw,
          outputAmountRaw: trade.outputAmountRaw,
          dexProgramId: ix.programId,
          dexName: venue.label,
        });
      trades.push(trade);
    } catch (e) {
      review.push(
        venue.id +
          " " +
          ix.instructionIndex +
          ": " +
          (e instanceof Error ? e.message : "Invalid execution"),
      );
    }
  }
  return { trades, review };
}
