import type { PositionOperation } from "./semantics/dca";
import { PYTH_MINT } from "./config";
import { TOKEN_PROGRAM, type NormalizedTransaction } from "./normalize";
export const CLASSIFIER_VERSION = 6;
export type EconomicAnalysis = {
  signature: string;
  normalizerVersion: number;
  classifierVersion: number;
  status: "AVAILABLE" | "UNAVAILABLE";
  domains: {
    id: string;
    controller: string | null;
    kind: "SIGNER_CONTROL" | "PROTOCOL_POSITION" | "UNRESOLVED_ACCOUNT";
    accounts: string[];
    assetChanges: { mint: string; decimals: number; netRaw: string | null }[];
    evidence: {
      accountingReconciled: boolean;
      pythNetChange: boolean;
      counterAssetNetChange: boolean;
      connectedExecution: boolean;
      mintBurnExcluded: boolean;
      liquidityOperationExcluded: boolean;
      supplyChangeTouchesDomain: boolean;
    };
    eventType: "TRANSFER" | "SWAP" | "PYTH_INTERMEDIATE" | "UNKNOWN";
    swapCandidate: {
      side: "BUY" | "SELL";
      pythAmountRaw: string;
      counterMint: string;
      counterAmountRaw: string;
    } | null;
    reasons: string[];
  }[];
};
/** State deltas first. Signer-controlled token accounts may be grouped; common PDA
 * authority alone never proves that separate vaults are one position. An adapter
 * must establish those relationships. Swap-shaped deltas are candidates, not trades. */
export function analyzeEconomicDomains(
  n: NormalizedTransaction,
  positions: PositionOperation[] = [],
): EconomicAnalysis {
  const r: EconomicAnalysis = {
    signature: n.signature,
    normalizerVersion: n.normalizerVersion,
    classifierVersion: CLASSIFIER_VERSION,
    status: n.status === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
    domains: [],
  };
  if (n.status === "UNAVAILABLE") return r;
  const memberships = new Map<string, Set<string>>();
  for (const p of positions.filter(
    (p) => p.status === "VERIFIED" && p.kind === "EXECUTION",
  )) {
    const id = `position:${p.programId}:${p.position}`;
    for (const account of p.vaults)
      memberships.set(
        account,
        new Set([...(memberships.get(account) ?? []), id]),
      );
  }
  const groups = new Map<string, typeof n.tokenStates>();
  for (const s of n.tokenStates) {
    const signer = s.owner && n.signers.includes(s.owner);
    const membership = memberships.get(s.account);
    const id =
      !signer && membership?.size === 1
        ? [...membership][0]
        : signer
          ? `signer:${s.owner}`
          : `account:${s.account}`;
    groups.set(id, [...(groups.get(id) ?? []), s]);
  }
  const pureTransfer = n.instructions.every(
    (i) => i.programId === TOKEN_PROGRAM && i.tokenEffect === "TRANSFER",
  );
  for (const [id, states] of groups) {
    if (!states.some((s) => s.mint === PYTH_MINT)) continue;
    const signer = id.startsWith("signer:"),
      accounts = states.map((s) => s.account);
    const assets = new Map<
      string,
      { mint: string; decimals: number; netRaw: string | null }
    >();
    for (const s of states) {
      const old = assets.get(s.mint);
      assets.set(s.mint, {
        mint: s.mint,
        decimals: s.decimals,
        netRaw:
          s.deltaRaw === null || old?.netRaw === null
            ? null
            : String(BigInt(old?.netRaw ?? "0") + BigInt(s.deltaRaw)),
      });
    }
    const assetChanges = [...assets.values()],
      pyth = assets.get(PYTH_MINT)!,
      others = assetChanges.filter(
        (a) => a.mint !== PYTH_MINT && a.netRaw !== null && a.netRaw !== "0",
      );
    const accountingReconciled =
      states.every((s) => !s.issues.length && s.deltaRaw !== null) &&
      !n.issues.length;
    const pythNetChange = pyth.netRaw !== null && pyth.netRaw !== "0";
    const counterAssetNetChange =
      others.length === 1 &&
      pythNetChange &&
      BigInt(others[0].netRaw!) * BigInt(pyth.netRaw!) < 0n;
    const incident = n.transfers.filter(
      (t) => accounts.includes(t.source) || accounts.includes(t.destination),
    );
    const roots = new Set(incident.map((t) => t.instructionIndex));
    // A shared outer call is necessary context, not proof of economic intent.
    const connectedExecution =
      incident.length >= 2 &&
      roots.size === 1 &&
      incident.every((t) => t.innerInstructionIndex !== null) &&
      n.instructions.some(
        (i) =>
          i.innerInstructionIndex === null &&
          roots.has(i.instructionIndex) &&
          i.programId !== TOKEN_PROGRAM,
      );
    const mintBurnExcluded = !n.instructions.some(
      (i) => i.tokenEffect === "MINT" || i.tokenEffect === "BURN",
    );
    const supplyChangeTouchesDomain = n.instructions.some(
      (i) =>
        (i.tokenEffect === "MINT" || i.tokenEffect === "BURN") &&
        i.accounts.some((a) => accounts.includes(a)),
    );
    const candidate =
      signer &&
      accountingReconciled &&
      counterAssetNetChange &&
      connectedExecution &&
      mintBurnExcluded;
    const transfer =
      pureTransfer &&
      accountingReconciled &&
      assetChanges.every((a) => a.mint === PYTH_MINT || a.netRaw === "0") &&
      incident.length > 0;
    r.domains.push({
      id,
      controller: signer ? states[0].owner : null,
      kind: signer
        ? "SIGNER_CONTROL"
        : id.startsWith("position:")
          ? "PROTOCOL_POSITION"
          : "UNRESOLVED_ACCOUNT",
      accounts,
      assetChanges,
      evidence: {
        accountingReconciled,
        pythNetChange,
        counterAssetNetChange,
        connectedExecution,
        mintBurnExcluded,
        liquidityOperationExcluded: false,
        supplyChangeTouchesDomain,
      },
      eventType: transfer ? "TRANSFER" : "UNKNOWN",
      swapCandidate: candidate
        ? {
            side: BigInt(pyth.netRaw!) > 0n ? "BUY" : "SELL",
            pythAmountRaw: String(
              BigInt(pyth.netRaw!) < 0n
                ? -BigInt(pyth.netRaw!)
                : BigInt(pyth.netRaw!),
            ),
            counterMint: others[0].mint,
            counterAmountRaw: String(
              BigInt(others[0].netRaw!) < 0n
                ? -BigInt(others[0].netRaw!)
                : BigInt(others[0].netRaw!),
            ),
          }
        : null,
      reasons: supplyChangeTouchesDomain
        ? [
            "Mint/burn touches this domain; possible receipt-token, liquidity or issuance operation",
          ]
        : transfer
          ? ["Direct token instructions; no cross-asset exchange"]
          : candidate
            ? [
                "Connected opposing asset deltas",
                "Receipt-token/vault semantics still require evidence",
              ]
            : [
                "Incomplete accounting, unresolved domain or ambiguous economic semantics",
              ],
    });
  }
  return r;
}
