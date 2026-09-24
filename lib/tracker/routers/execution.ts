import { record, rawAmount } from "../helius-format";
import type { Instruction, Transaction, Trade } from "../types";
import { swapParser } from "../parsers/swap";
import { ROUTER_ADAPTERS, routerFor, type RouterAdapter } from "./registry";
import { settlementSummary } from "./settlement";
import { transferLegSummary } from "../venues/transfer-leg";

const INFRASTRUCTURE = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "ComputeBudget111111111111111111111111111111",
]);

/** Shared economic boundary: prefer the router's executed summary; otherwise
 * collapse non-overlapping child summaries. Intermediate raw amounts must cancel
 * exactly. Multiple inputs/outputs or disconnected cycles require review. */
export function routerExecution(
  tx: Transaction,
  root: Instruction,
  children: Instruction[],
  adapter: RouterAdapter,
): Trade | null {
  const settlement = settlementSummary(tx, root, children);
  let summary = settlement ?? root.summary;
  let derived = false;
  let transferVerified = false;
  if (summary?.type !== "swap") {
    const legs: Instruction[] = [];
    const ancestors: Instruction[] = [];
    for (const [index, original] of children.entries()) {
      let ix = original;
      if (ix.stackHeight === null) throw new Error("Missing CPI ancestry");
      while (
        ancestors.length &&
        ancestors.at(-1)!.stackHeight! >= ix.stackHeight
      )
        ancestors.pop();
      if (
        ix.summary?.type !== "swap" &&
        !ancestors.some((a) => a.summary?.type === "swap")
      ) {
        const recovered = transferLegSummary(tx, ix, children.slice(index + 1));
        if (recovered) {
          ix = { ...ix, summary: recovered };
          transferVerified = true;
        }
      }
      if (
        ix.summary?.type !== "swap" &&
        !ancestors.some((a) => a.summary?.type === "swap") &&
        !INFRASTRUCTURE.has(ix.programId) &&
        ix.programId !== root.programId &&
        !routerFor(ix)
      )
        throw new Error(
          "Undecoded execution branch: " +
            ix.programId +
            " at " +
            ix.instructionIndex +
            ":" +
            ix.innerInstructionIndex,
        );
      if (
        ix.summary?.type === "swap" &&
        !ancestors.some((a) => a.summary?.type === "swap")
      )
        legs.push(ix);
      ancestors.push(ix);
    }
    if (!legs.length) throw new Error("No decoded economic execution");
    if (legs.length > 32) throw new Error("Too many route legs");
    const balances = new Map<string, bigint>();
    const edges: {
      input_mint: string;
      output_mint: string;
      input_amount: string;
      output_amount: string;
      amm_program_id: string;
      amm_program_name: string;
    }[] = [];
    const add = (mint: string, amount: bigint) =>
      balances.set(mint, (balances.get(mint) ?? 0n) + amount);
    for (const ix of legs) {
      const d = record(ix.summary?.parsedData);
      if (typeof d.input_mint !== "string" || typeof d.output_mint !== "string")
        throw new Error("Missing route mints");
      const input = rawAmount(d.in_amount),
        output = rawAmount(d.actual_out_amount);
      if (
        BigInt(input) <= 0n ||
        BigInt(output) <= 0n ||
        d.input_mint === d.output_mint
      )
        throw new Error("Invalid route amounts");
      add(d.input_mint, -BigInt(input));
      add(d.output_mint, BigInt(output));
      edges.push({
        input_mint: d.input_mint,
        output_mint: d.output_mint,
        input_amount: input,
        output_amount: output,
        amm_program_id: ix.programId,
        amm_program_name: ix.programName ?? ix.programId,
      });
    }
    const inputs = [...balances].filter(([, a]) => a < 0n),
      outputs = [...balances].filter(([, a]) => a > 0n);
    if (inputs.length !== 1 || outputs.length !== 1)
      throw new Error("Ambiguous economic boundary");
    // All legs must be reachable from the economic input, without directed cycles.
    const reachable = new Set([inputs[0][0]]);
    for (let i = 0; i < edges.length; i++)
      for (const e of edges)
        if (reachable.has(e.input_mint)) reachable.add(e.output_mint);
    if (edges.some((e) => !reachable.has(e.input_mint)))
      throw new Error("Disconnected executions");
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const visit = (mint: string) => {
      if (visiting.has(mint)) throw new Error("Cyclic route requires review");
      if (visited.has(mint)) return;
      visiting.add(mint);
      for (const e of edges.filter((e) => e.input_mint === mint))
        visit(e.output_mint);
      visiting.delete(mint);
      visited.add(mint);
    };
    visit(inputs[0][0]);
    summary = {
      type: "swap",
      parsedData: {
        input_mint: inputs[0][0],
        output_mint: outputs[0][0],
        in_amount: (-inputs[0][1]).toString(),
        actual_out_amount: outputs[0][1].toString(),
        inner_swaps: edges,
      },
    };
    derived = true;
  }
  const trade = swapParser(tx, { ...root, summary });
  if (!trade) return null;
  trade.router = adapter.id;
  if (settlement) trade.flags.push("TRANSFER_VERIFIED_SETTLEMENT");
  trade.classificationConfidence = derived ? "MEDIUM" : "HIGH";
  // Named decoded authority only; never raw account positions, fee payer or keeper.
  const owners = [
    ...new Set(
      adapter.ownerRoles.flatMap((role) =>
        root.accounts[role] ? [root.accounts[role]] : [],
      ),
    ),
  ];
  trade.owner =
    root.innerInstructionIndex === null && owners.length === 1
      ? owners[0]
      : null;
  trade.ownerConfidence = trade.owner ? "MEDIUM" : "UNRESOLVED";
  if (!trade.owner) trade.flags.push("OWNER_UNRESOLVED");
  if (derived) trade.flags.push("DERIVED_FROM_ROUTE_EXECUTIONS");
  if (transferVerified) trade.flags.push("TRANSFER_VERIFIED_ROUTE_LEG");
  return trade;
}

export function genericRouters(
  tx: Transaction,
  adapters = ROUTER_ADAPTERS,
  excluded = new Set<Instruction>(),
) {
  const trades: Trade[] = [],
    review: string[] = [],
    consumed = new Set<Instruction>();
  for (let i = 0; i < tx.instructions.length; i++) {
    const root = tx.instructions[i];
    if (consumed.has(root) || excluded.has(root)) continue;
    const adapter = routerFor(root, adapters);
    if (!adapter || adapter.id === "JUPITER") continue;
    // Jupiter's outer economic summary owns its inner routers. Its specialized
    // parser will handle that subtree and automated-order attribution.
    if (
      root.innerInstructionIndex !== null &&
      tx.instructions
        .slice(0, i)
        .some(
          (p) =>
            p.instructionIndex === root.instructionIndex &&
            routerFor(p, adapters)?.id === "JUPITER" &&
            p.summary?.type === "swap" &&
            (p.stackHeight ?? 1) < (root.stackHeight ?? 0),
        )
    )
      continue;
    const children: Instruction[] = [];
    const height = root.innerInstructionIndex === null ? 1 : root.stackHeight;
    if (height === null) {
      review.push(`${adapter.id}: missing root ancestry`);
      consumed.add(root);
      continue;
    }
    for (let j = i + 1; j < tx.instructions.length; j++) {
      const ix = tx.instructions[j];
      if (
        ix.instructionIndex !== root.instructionIndex ||
        (ix.stackHeight !== null && ix.stackHeight <= height)
      )
        break;
      children.push(ix);
    }
    consumed.add(root);
    for (const ix of children) consumed.add(ix);
    if (children.some((ix) => excluded.has(ix))) continue;
    if (
      adapter.setupInstructions?.includes(root.instructionName ?? "") &&
      !root.summary &&
      children.every(
        (ix) =>
          INFRASTRUCTURE.has(ix.programId) &&
          (!ix.summary ||
            ["create_token_account", "create_account", "transfer"].includes(
              String(ix.summary.type),
            )),
      )
    )
      continue;
    try {
      const trade = routerExecution(tx, root, children, adapter);
      if (trade) trades.push(trade);
    } catch (e) {
      review.push(
        `${adapter.id} ${root.instructionIndex}:${root.innerInstructionIndex ?? "top"}: ${e instanceof Error ? e.message : "Unknown execution"}`,
      );
    }
  }
  return { trades, review, consumed };
}
