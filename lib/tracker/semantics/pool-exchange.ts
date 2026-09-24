import type { IntermediateCycle } from "./intermediate-cycle";
import { type NormalizedTransaction } from "../normalize";
import { PARSER_VERSION, PYTH_MINT, ROUTER } from "../config";
import type { EconomicAnalysis } from "../economic-domains";
import type { ParseResult, Trade } from "../types";
import { attestPoolSwaps, CLMM, DAMM_V2 } from "./pool-proof";
/** Narrow execution attestation, not a router mapping. A verified pool call
 * establishes swap semantics; nested calls also require matching domain deltas.
 * Independent top-level calls may each produce a trade. */
export function confirmPoolExchange(
  rawValue: unknown,
  n: NormalizedTransaction,
  e: EconomicAnalysis,
): Trade[] {
  const states = new Map(n.tokenStates.map((s) => [s.account, s]));
  const trades: Trade[] = [];
  for (const {
    ix,
    input,
    output,
    authority,
    name,
    fees,
    inputOwner,
    outputOwner,
  } of attestPoolSwaps(rawValue, n)) {
    const root = n.instructions.find(
      (i) =>
        i.instructionIndex === ix.instructionIndex &&
        i.innerInstructionIndex === null,
    )!;
    // A delegated owner need not sign the transaction. For DAMM v2, require
    // a Jupiter parent, exact owner token accounts and the entire two-transfer
    // execution before treating an unknown outer program as a swap.
    const delegatedDamm =
      ix.programId === DAMM_V2 &&
      !n.signers.includes(authority) &&
      ix.stackHeight === 3 &&
      ix.innerInstructionIndex !== null &&
      n.status === "RECONCILED" &&
      n.transfers.length === 2 + fees.length &&
      root.accounts.includes(authority) &&
      root.accounts.includes(input.source) &&
      root.accounts.includes(output.destination) &&
      n.instructions.some(
        (parent) =>
          parent.programId === ROUTER &&
          parent.instructionIndex === ix.instructionIndex &&
          parent.innerInstructionIndex !== null &&
          parent.innerInstructionIndex < ix.innerInstructionIndex! &&
          parent.stackHeight === 2 &&
          parent.accounts.includes(authority) &&
          parent.accounts.includes(input.source) &&
          parent.accounts.includes(output.destination),
      );
    if (
      (!n.signers.includes(authority) && !delegatedDamm) ||
      inputOwner !== authority ||
      outputOwner !== authority
    )
      continue;
    if (input.mint !== PYTH_MINT && output.mint !== PYTH_MINT) continue;
    const d = e.domains.find(
      (d) => d.kind === "SIGNER_CONTROL" && d.controller === authority,
    );
    if (!d && !delegatedDamm) continue;
    const side = input.mint === PYTH_MINT ? "SELL" : "BUY";
    const credit = output.receivedAmountRaw ?? output.amountRaw;
    const observed = {
      side: side as "SELL" | "BUY",
      pythAmountRaw: side === "SELL" ? input.amountRaw : credit,
      counterMint: (side === "SELL" ? output.mint : input.mint)!,
      counterAmountRaw: side === "SELL" ? credit : input.amountRaw,
    };
    const standalone = ix.innerInstructionIndex === null;
    const candidate = standalone || delegatedDamm ? observed : d!.swapCandidate;
    if (!candidate) continue;
    if (
      !standalone &&
      (n.status !== "RECONCILED" ||
        n.transfers.length !== 2 + fees.length ||
        (!delegatedDamm &&
          (candidate.side !== observed.side ||
            candidate.pythAmountRaw !== observed.pythAmountRaw ||
            candidate.counterMint !== observed.counterMint ||
            candidate.counterAmountRaw !== observed.counterAmountRaw)))
    )
      continue;
    if (
      states.get(candidate.side === "SELL" ? input.source : output.destination)
        ?.decimals !== 6
    )
      continue;
    if (d) {
      d.eventType = "SWAP";
      d.evidence.liquidityOperationExcluded = true;
      d.reasons = [
        standalone
          ? "Verified top-level pool execution with reconciled token transfers"
          : "Reconciled domain deltas match the verified pool exchange",
        "Outer router identity is not required",
      ];
    }
    trades.push({
      router: "STATE_EXCHANGE",
      tradeId: `${n.signature}:${root.instructionIndex}:state`,
      signature: n.signature,
      slot: n.slot,
      blockTime: n.blockTime,
      side: candidate.side,
      inputMint: input.mint!,
      outputMint: output.mint!,
      inputAmountRaw: input.amountRaw,
      outputAmountRaw: credit,
      pythAmountRaw: candidate.pythAmountRaw,
      counterMint: candidate.counterMint,
      counterAmountRaw: candidate.counterAmountRaw,
      counterDecimals: states.get(
        candidate.side === "SELL" ? output.destination : input.source,
      )!.decimals,
      product: "SWAP",
      owner: authority,
      ownerConfidence: "HIGH",
      classificationConfidence: "HIGH",
      executionProgramId: root.programId,
      executionAuthority: authority,
      orderKey: null,
      routeLegs: [
        {
          inputMint: input.mint!,
          outputMint: output.mint!,
          inputAmountRaw: input.amountRaw,
          outputAmountRaw: output.amountRaw,
          dexProgramId: ix.programId,
          dexName: name,
        },
      ],
      flags: [
        standalone ? "RAW_POOL_EXECUTION" : "STATE_DELTA_EXCHANGE",
        "RAW_POOL_SWAP_VERIFIED",
        "TOKEN_EXECUTION_AMOUNTS",
        ...(delegatedDamm ? ["RAW_DELEGATED_DAMM_EXCHANGE"] : []),
        ...(standalone ? ["RAW_INDEPENDENT_POOL_EXECUTION"] : []),
        ...(n.transfers.length !== 2 + fees.length
          ? ["PARTIAL_TRANSACTION_EXECUTION"]
          : []),
      ],
      parserVersion: PARSER_VERSION,
      usdValue: null,
      priceUsd: null,
      priceTimestamp: null,
      priceSource: null,
    });
  }
  return trades;
}
/** Shared by both workers. Append only independent, reviewed pool roots. */
export function mergeConfirmedExchange(
  result: ParseResult,
  trades: Trade[],
  exclusions: IntermediateCycle[] = [],
): ParseResult {
  // A top-level pool call is an independent execution boundary. Append only
  // when its exact unsupported-root review exists and no existing trade uses
  // that root. Nested routes retain the all-or-nothing merge below.
  if (!result.orders.length && !result.arbitrages?.length) {
    const additions = trades.filter((t) => {
      const root = t.tradeId.split(":")[1];
      return (
        t.flags.includes("RAW_INDEPENDENT_POOL_EXECUTION") &&
        result.review.includes(
          `Unsupported execution program ${t.executionProgramId} at ${root}:top: decoded swap evidence requires economic boundary review`,
        ) &&
        result.trades.every((old) => old.tradeId.split(":")[1] !== root)
      );
    });
    if (additions.length) {
      const resolved = new Set(
        additions.map(
          (t) =>
            `Unsupported execution program ${t.executionProgramId} at ${t.tradeId.split(":")[1]}:top: decoded swap evidence requires economic boundary review`,
        ),
      );
      return {
        ...result,
        trades: [...result.trades, ...additions],
        review: result.review.filter((r) => !resolved.has(r)),
      };
    }
  }
  if (
    !result.trades.length &&
    !result.orders.length &&
    !result.arbitrages?.length &&
    !trades.length &&
    exclusions.length === 1
  ) {
    const exclusion = exclusions[0];
    const resolved = `Unsupported execution program ${exclusion.programId} at ${exclusion.instructionIndex}:top: decoded swap evidence requires economic boundary review`;
    return {
      ...result,
      review: result.review.filter(
        (r) => r !== resolved && r !== "Provider could not decode transaction",
      ),
    };
  }
  if (
    trades.length !== 1 ||
    result.trades.length ||
    result.orders.length ||
    result.arbitrages?.length
  )
    return result;
  const review = result.review.filter(
    (reason) =>
      !(
        reason === "Provider could not decode transaction" &&
        !trades[0].flags.includes("PARTIAL_TRANSACTION_EXECUTION")
      ) &&
      reason !==
        `Unsupported execution program ${trades[0].executionProgramId} at ${trades[0].tradeId.split(":")[1]}:top: decoded swap evidence requires economic boundary review` &&
      !(
        trades[0].executionProgramId === CLMM &&
        reason === "RAYDIUM_CLMM: unsupported swap instruction"
      ),
  );
  return { ...result, trades, review };
}
