import {
  TOKEN_PROGRAM,
  WSOL_MINT,
  type NormalizedTransaction,
} from "./normalize";

/** Reconciles native holdings with WSOL transfers, without counting both as assets.
 * No wallet delta is silently assumed to be swap consideration. */
export function analyzeNativeSol(n: NormalizedTransaction) {
  const domains: {
    controller: string;
    accounts: string[];
    nativeNetRaw: string | null;
    wsolBoundaryNetRaw: string;
    status: "RECONCILED" | "UNRESOLVED";
    issues: string[];
  }[] = [];
  if (n.status === "UNAVAILABLE") return { domains };
  const owned = new Map(
    n.tokenStates
      .filter((s) => s.owner && s.tokenProgram === TOKEN_PROGRAM)
      .map((s) => [s.account, s.owner!]),
  );
  const lifecycleIssues = new Map<string, string>();
  const native = new Map(n.native.balances.map((b) => [b.account, b]));
  // Only a complete create/close lifecycle may establish a temporary account owner.
  for (const init of n.instructions.filter((i) => i.initializedOwner)) {
    const account = init.accounts[0],
      balance = native.get(account);
    const relevant = n.instructions.filter(
      (i) => i.programId === TOKEN_PROGRAM && i.accounts[0] === account,
    );
    const closes = relevant.filter((i) => i.tokenEffect === "CLOSE");
    const first = n.instructions.indexOf(init),
      last = closes.length === 1 ? n.instructions.indexOf(closes[0]) : -1;
    const state = n.tokenStates.find((s) => s.account === account);
    const valid =
      balance?.preRaw === "0" &&
      balance.postRaw === "0" &&
      relevant.filter((i) => i.tokenEffect === "INITIALIZE").length === 1 &&
      last > first &&
      closes[0].accounts[1] === init.initializedOwner &&
      relevant.every((i) =>
        [1, 3, 9, 12, 16, 17, 18].includes(i.tokenOpcode ?? -1),
      ) &&
      n.transfers
        .filter((t) => t.source === account || t.destination === account)
        .every((t) => {
          const at = n.instructions.findIndex(
            (i) =>
              i.instructionIndex === t.instructionIndex &&
              i.innerInstructionIndex === t.innerInstructionIndex,
          );
          return at > first && at < last && t.mint === init.accounts[1];
        }) &&
      (!state || state.mint === init.accounts[1]);
    if (valid) owned.set(account, init.initializedOwner!);
    else if (!owned.has(account))
      lifecycleIssues.set(
        init.initializedOwner!,
        "Incomplete or conflicting token-account lifecycle",
      );
  }
  for (const controller of n.signers) {
    const accounts = [
      controller,
      ...[...owned]
        .filter(([, owner]) => owner === controller)
        .map(([account]) => account),
    ];
    const set = new Set(accounts);
    const relevant = n.transfers.filter(
      (t) =>
        t.mint === WSOL_MINT && (set.has(t.source) || set.has(t.destination)),
    );
    const hasWsol =
      n.tokenStates.some((s) => s.mint === WSOL_MINT && set.has(s.account)) ||
      n.instructions.some(
        (i) => i.initializedOwner === controller && i.accounts[1] === WSOL_MINT,
      );
    if (!hasWsol && !relevant.length) continue;
    const issues: string[] = [];
    if (lifecycleIssues.has(controller))
      issues.push(lifecycleIssues.get(controller)!);
    if (
      n.native.issues.some(
        (i) => i !== "Rent/WSOL consideration requires reconciliation",
      )
    )
      issues.push("Native evidence is incomplete or inconsistent");
    if (n.issues.length) issues.push("Unresolved token instruction evidence");
    // Authority changes invalidate ownership grouping even if later changed back.
    if (
      n.instructions.some(
        (i) =>
          i.programId === TOKEN_PROGRAM &&
          i.tokenOpcode === 6 &&
          set.has(i.accounts[0]),
      )
    )
      issues.push("Token authority changed during execution");
    let delta: bigint | null = 0n;
    for (const account of set) {
      const b = native.get(account);
      if (!b) {
        delta = null;
        break;
      }
      delta += BigInt(b.feeAdjustedDeltaRaw);
    }
    const boundary = relevant.reduce(
      (sum, t) =>
        sum +
        (set.has(t.destination) ? BigInt(t.amountRaw) : 0n) -
        (set.has(t.source) ? BigInt(t.amountRaw) : 0n),
      0n,
    );
    if (delta === null) issues.push("Native account balances unavailable");
    else if (delta !== boundary)
      issues.push(
        "Native delta includes unexplained funding, rent, tips or other SOL transfers",
      );
    domains.push({
      controller,
      accounts: [...set],
      nativeNetRaw: delta === null ? null : String(delta),
      wsolBoundaryNetRaw: String(boundary),
      status: issues.length ? "UNRESOLVED" : "RECONCILED",
      issues,
    });
  }
  return { domains };
}
