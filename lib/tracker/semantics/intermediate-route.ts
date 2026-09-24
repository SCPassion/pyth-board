import { PYTH_MINT } from "../config";
import type { NormalizedTransaction } from "../normalize";
import { attestPoolSwaps } from "./pool-proof";
import { temporaryOwners } from "./temporary-accounts";
import type { IntermediateCycle } from "./intermediate-cycle";
/** Proves PYTH's role, not the economics of unrelated route assets.
 * Exactly two attested pool calls exchange the same PYTH amount through the
 * same signer-controlled account. Every PYTH transfer, including pool fees,
 * and every PYTH balance delta must be accounted for. */
export function confirmIntermediateRoute(
  raw: unknown,
  n: NormalizedTransaction,
): IntermediateCycle[] {
  const legs = attestPoolSwaps(raw, n).filter(
    (l) => l.input.mint === PYTH_MINT || l.output.mint === PYTH_MINT,
  );
  if (legs.length !== 2) return [];
  const [first, last] = legs;
  if (
    n.instructions.some(
      (i) =>
        i.instructionIndex === first.ix.instructionIndex &&
        i.stackHeight === null,
    )
  )
    return [];
  if (
    first.output.mint !== PYTH_MINT ||
    last.input.mint !== PYTH_MINT ||
    first.outputOwner !== last.inputOwner ||
    first.inputOwner !== last.outputOwner ||
    !n.signers.includes(first.inputOwner) ||
    first.ix.instructionIndex !== last.ix.instructionIndex ||
    first.output.destination !== last.input.source ||
    first.output.amountRaw !== last.input.amountRaw
  )
    return [];
  const transfers = new Set(
    legs
      .flatMap((l) => [l.input, l.output, ...l.fees])
      .filter((t) => t.mint === PYTH_MINT),
  );
  if (n.transfers.some((t) => t.mint === PYTH_MINT && !transfers.has(t)))
    return [];
  const temporary = temporaryOwners(n);
  const pyth = n.tokenStates.filter((s) => s.mint === PYTH_MINT);
  if (
    !pyth.length ||
    pyth.some((s) => {
      if (
        s.issues.length &&
        !(
          temporary.has(s.account) &&
          s.issues.every((i) => i === "Missing endpoint balances")
        )
      )
        return true;
      const net = n.transfers.reduce(
        (v, t) =>
          v +
          (t.destination === s.account ? BigInt(t.amountRaw) : 0n) -
          (t.source === s.account ? BigInt(t.amountRaw) : 0n),
        0n,
      );
      if (s.deltaRaw !== null ? BigInt(s.deltaRaw) !== net : net !== 0n)
        return true;
      return (
        (n.signers.includes(s.owner ?? "") ||
          s.owner === first.outputOwner ||
          temporary.has(s.account)) &&
        net !== 0n
      );
    })
  )
    return [];
  const root = n.instructions.find(
    (i) =>
      i.instructionIndex === first.ix.instructionIndex &&
      i.innerInstructionIndex === null,
  )!;
  return [
    {
      kind: "PYTH_INTERMEDIATE_ROUTE",
      instructionIndex: root.instructionIndex,
      programId: root.programId,
      controller: first.inputOwner,
      pythAmountRaw: first.output.amountRaw,
      poolCalls: 2,
    },
  ];
}
