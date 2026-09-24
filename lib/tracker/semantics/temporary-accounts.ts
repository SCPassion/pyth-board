import { TOKEN_PROGRAM, type NormalizedTransaction } from "../normalize";
/** Ownership only. Does not invent token balances or turn native costs into swaps. */
export function temporaryOwners(n: NormalizedTransaction): Map<string, string> {
  const owners = new Map<string, string>();
  for (const init of n.instructions.filter(
    (i) => i.programId === TOKEN_PROGRAM && i.initializedOwner,
  )) {
    const account = init.accounts[0];
    const native = n.native.balances.find((b) => b.account === account);
    const operations = n.instructions.filter(
      (i) => i.programId === TOKEN_PROGRAM && i.accounts[0] === account,
    );
    const closes = operations.filter((i) => i.tokenEffect === "CLOSE");
    const close = closes[0];
    if (
      native?.preRaw !== "0" ||
      native.postRaw !== "0" ||
      closes.length !== 1 ||
      operations.filter((i) => i.tokenEffect === "INITIALIZE").length !== 1 ||
      close.accounts[2] !== init.initializedOwner ||
      operations.some(
        (i) => ![1, 3, 9, 12, 16, 17, 18, 22].includes(i.tokenOpcode ?? -1),
      )
    )
      continue;
    const first = n.instructions.indexOf(init),
      last = n.instructions.indexOf(close);
    if (last <= first || !n.signers.includes(init.initializedOwner!)) continue;
    if (
      !n.transfers
        .filter((t) => t.source === account || t.destination === account)
        .every((t) => {
          const at = n.instructions.findIndex(
            (i) =>
              i.instructionIndex === t.instructionIndex &&
              i.innerInstructionIndex === t.innerInstructionIndex,
          );
          return at > first && at < last && t.mint === init.accounts[1];
        })
    )
      continue;
    owners.set(account, init.initializedOwner!);
  }
  return owners;
}
