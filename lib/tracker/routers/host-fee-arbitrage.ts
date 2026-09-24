import { PARSER_VERSION, PYTH_MINT } from "../config";
import { rawAmount, record } from "../helius-format";
import type { ArbitrageExecution, Instruction, Transaction } from "../types";
import { verifiedWrapperLeg } from "./wrapper-cycle";

const WRAPPER = "G2E4eoenFMirpFKRfHNo2koDP7mrhnNWVwxyHASSpjQD";
const WHIRL = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const DLMM = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const check = (v: unknown) => {
  if (!v) throw new Error("Unverified host-fee arbitrage");
};
const positive = (v: unknown) => {
  const n = BigInt(rawAmount(v));
  check(n > 0n);
  return n;
};
function roles(ix: Instruction, wanted: Record<string, string>) {
  for (const [key, value] of Object.entries(wanted))
    check(value && ix.accounts[key] === value);
}
/** Only the observed USDC → intermediary → PYTH → USDC shape, with a DLMM
 * host fee paid to the same execution authority's PYTH account. Never a BUY/SELL. */
export function hostFeeArbitrage(
  tx: Transaction,
  root: Instruction,
  c: Instruction[],
): ArbitrageExecution | null {
  if (root.programId !== WRAPPER) return null;
  try {
    check(
      tx.success &&
        root.innerInstructionIndex === null &&
        root.stackHeight === 1 &&
        root.instructionName === null &&
        !root.summary,
    );
    check(
      c.length === 12 &&
        tx.decimals[PYTH_MINT] === 6 &&
        tx.decimals[USDC] === 6,
    );
    const shape: [string, string, number][] = [
      [WHIRL, "swap_v2", 2],
      [TOKEN, "transfer_checked", 3],
      [TOKEN, "transfer_checked", 3],
      [WHIRL, "swap_v2", 2],
      [TOKEN, "transfer_checked", 3],
      [TOKEN, "transfer_checked", 3],
      [DLMM, "swap2", 2],
      [DLMM, "Swap", 3],
      [TOKEN, "transfer_checked", 3],
      [TOKEN, "transfer_checked", 3],
      [TOKEN, "transfer_checked", 3],
      [DLMM, "Swap2Evt", 3],
    ];
    c.forEach((ix, i) =>
      check(
        ix.instructionIndex === root.instructionIndex &&
          ix.innerInstructionIndex === i &&
          ix.programId === shape[i][0] &&
          ix.instructionName === shape[i][1] &&
          ix.stackHeight === shape[i][2],
      ),
    );
    const first = verifiedWrapperLeg(tx, c[0], c.slice(1, 3));
    const second = verifiedWrapperLeg(tx, c[3], c.slice(4, 6));
    check(
      first.inputMint === USDC &&
        second.outputMint === PYTH_MINT &&
        first.outputMint === second.inputMint &&
        ![USDC, PYTH_MINT].includes(first.outputMint) &&
        first.output === second.input &&
        first.credit === second.debit &&
        first.owner === second.owner,
    );
    const a = c[6].accounts,
      owner = first.owner;
    roles(c[6], {
      user: owner,
      user_token_in: second.output,
      user_token_out: first.input,
      host_fee_in: second.output,
      token_x_mint: PYTH_MINT,
      token_y_mint: USDC,
      token_x_program: TOKEN,
      token_y_program: TOKEN,
      program: DLMM,
    });
    const userAccounts = new Set([first.input, first.output, second.output]);
    check(
      userAccounts.size === 3 &&
        [...first.vaults, ...second.vaults, a.reserve_x, a.reserve_y].every(
          (v) => v && !userAccounts.has(v),
        ) &&
        a.reserve_x !== a.reserve_y,
    );
    const transfer = (
      ix: Instruction,
      source: string,
      destination: string,
      authority: string,
      mint: string,
    ) => {
      roles(ix, {
        source_account: source,
        destination_account: destination,
        owner_or_delegate: authority,
        mint,
      });
      check(ix.args.decimals === 6 && source !== destination);
      return positive(ix.args.amount);
    };
    const pythDebit = transfer(
      c[8],
      second.output,
      a.reserve_x,
      owner,
      PYTH_MINT,
    );
    const hostFee = transfer(
      c[9],
      a.reserve_x,
      second.output,
      a.lb_pair,
      PYTH_MINT,
    );
    const usdcCredit = transfer(
      c[10],
      a.reserve_y,
      first.input,
      a.lb_pair,
      USDC,
    );
    check(
      pythDebit === second.credit &&
        pythDebit === positive(c[6].args.amount_in) &&
        hostFee < pythDebit &&
        usdcCredit > first.debit,
    );
    const summary = record(c[6].summary?.parsedData);
    check(
      c[6].summary?.type === "swap" &&
        summary.input_mint === PYTH_MINT &&
        summary.output_mint === USDC &&
        positive(summary.in_amount) === pythDebit &&
        positive(summary.actual_out_amount) === usdcCredit,
    );
    for (const event of [c[7], c[11]]) {
      const e = event.args;
      check(
        e.lb_pair === a.lb_pair &&
          e.from === owner &&
          e.swap_for_y === true &&
          positive(e.amount_in) === pythDebit &&
          positive(e.amount_out) === usdcCredit &&
          positive(e.host_fee) === hostFee,
      );
    }
    const e = c[11].args;
    check(
      rawAmount(e.amount_left) === "0" &&
        e.fees_on_input === true &&
        e.fees_on_token_x === true &&
        rawAmount(e.limit_order_fee) === "0" &&
        rawAmount(c[7].args.protocol_fee) === rawAmount(e.protocol_fee) &&
        positive(c[7].args.fee) ===
          positive(e.mm_fee) + positive(e.protocol_fee) + hostFee,
    );
    return {
      kind: "ARBITRAGE_WITH_HOST_FEE",
      executionId: `${tx.signature}:${root.instructionIndex}:top`,
      signature: tx.signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      executionProgramId: root.programId,
      executionAuthority: owner,
      parserVersion: PARSER_VERSION,
      settlements: [
        {
          mint: USDC,
          decimals: 6,
          tokenAccount: first.input,
          debitRaw: first.debit.toString(),
          creditRaw: usdcCredit.toString(),
          netRaw: (usdcCredit - first.debit).toString(),
        },
        {
          mint: PYTH_MINT,
          decimals: 6,
          tokenAccount: second.output,
          debitRaw: pythDebit.toString(),
          creditRaw: (second.credit + hostFee).toString(),
          netRaw: hostFee.toString(),
        },
      ],
      hostFee: {
        mint: PYTH_MINT,
        amountRaw: hostFee.toString(),
        tokenAccount: second.output,
        programId: DLMM,
      },
      routeLegs: [
        ...[first, second].map((l) => ({
          inputMint: l.inputMint,
          outputMint: l.outputMint,
          inputAmountRaw: l.debit.toString(),
          outputAmountRaw: l.credit.toString(),
          dexProgramId: WHIRL,
          dexName: "Orca Whirlpool",
        })),
        {
          inputMint: PYTH_MINT,
          outputMint: USDC,
          inputAmountRaw: pythDebit.toString(),
          outputAmountRaw: usdcCredit.toString(),
          dexProgramId: DLMM,
          dexName: "Meteora DLMM",
        },
      ],
    };
  } catch {
    return null;
  }
}
