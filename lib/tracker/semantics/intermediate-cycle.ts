import { PYTH_MINT } from "../config";
import type { EconomicAnalysis } from "../economic-domains";
import type { NormalizedTransaction } from "../normalize";
import { attestPoolSwaps } from "./pool-proof";
export type IntermediateCycle = {
  kind: "PYTH_INTERMEDIATE_CYCLE" | "PYTH_INTERMEDIATE_ROUTE";
  instructionIndex: number;
  programId: string;
  controller: string;
  settlementMint?: string;
  settlementNetRaw?: string;
  pythAmountRaw?: string;
  poolCalls: number;
};
/** Only a completely attested, account-connected cycle can clear its own review.
 * Net-zero PYTH alone is never an exclusion rule. */
export function confirmIntermediateCycle(
  raw: unknown,
  n: NormalizedTransaction,
  e: EconomicAnalysis,
): IntermediateCycle[] {
  const legs = attestPoolSwaps(raw, n);
  if (
    legs.length < 2 ||
    legs.length > 8 ||
    legs.length * 2 !== n.transfers.length
  )
    return [];
  const first = legs[0],
    last = legs.at(-1)!;
  const keys = (t: typeof first.input) =>
    `${t.instructionIndex}:${t.innerInstructionIndex}`;
  if (
    new Set(legs.flatMap((l) => [keys(l.input), keys(l.output)])).size !==
    n.transfers.length
  )
    return [];
  if (
    legs.some(
      (l) =>
        l.authority !== first.authority ||
        l.ix.instructionIndex !== first.ix.instructionIndex,
    )
  )
    return [];
  if (
    first.input.mint === PYTH_MINT ||
    first.input.mint !== last.output.mint ||
    first.input.source !== last.output.destination
  )
    return [];
  if (
    !legs.some((l) => l.input.mint === PYTH_MINT || l.output.mint === PYTH_MINT)
  )
    return [];
  for (let i = 1; i < legs.length; i++) {
    const previous = legs[i - 1].output,
      next = legs[i].input;
    if (
      previous.destination !== next.source ||
      previous.mint !== next.mint ||
      previous.amountRaw !== next.amountRaw
    )
      return [];
  }
  const root = n.instructions.find(
    (i) =>
      i.instructionIndex === first.ix.instructionIndex &&
      i.innerInstructionIndex === null,
  );
  if (!root) return [];
  const consumed = new Set(legs.flatMap((l) => [l.ix, ...l.descendants]));
  if (
    n.instructions.some(
      (i) =>
        i.instructionIndex === root.instructionIndex &&
        i !== root &&
        !consumed.has(i),
    )
  )
    return [];
  const domain = e.domains.find(
    (d) => d.kind === "SIGNER_CONTROL" && d.controller === first.authority,
  );
  const profit = String(
    BigInt(last.output.amountRaw) - BigInt(first.input.amountRaw),
  );
  if (
    !domain?.evidence.accountingReconciled ||
    domain.assetChanges.some(
      (a) => a.netRaw !== (a.mint === first.input.mint ? profit : "0"),
    )
  )
    return [];
  if (
    !domain.assetChanges.some((a) => a.mint === first.input.mint) ||
    !domain.assetChanges.some((a) => a.mint === PYTH_MINT && a.netRaw === "0")
  )
    return [];
  domain.eventType = "PYTH_INTERMEDIATE";
  domain.reasons = [
    "Every pool leg is attested and adjacent transfer accounts and amounts connect exactly",
    "Cycle settles in another asset; PYTH net change is zero",
  ];
  return [
    {
      kind: "PYTH_INTERMEDIATE_CYCLE",
      instructionIndex: root.instructionIndex,
      programId: root.programId,
      controller: first.authority,
      settlementMint: first.input.mint!,
      settlementNetRaw: profit,
      poolCalls: legs.length,
    },
  ];
}
