import { rawAmount } from "../helius-format";
import type { Instruction, Transaction } from "../types";

const SWAP = "swapFpHZwjELNnjvThjajtiVmkz3yPQEHjLtka2fwHW";
const VAULT = "vo1tWgqZMjG61Z2T9qUaMYKqZ75CYzMuaZ2LZP1n7HV";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/** Recover only the fixture-verified classic-token swap_v2 shape. Requested
 * output thresholds never become executed amounts. Extra CPIs, fees, extensions
 * or missing account/ancestry evidence leave the parent route in review. */
export function transferLegSummary(
  tx: Transaction,
  root: Instruction,
  following: Instruction[],
): Instruction["summary"] {
  if (root.programId !== SWAP || root.instructionName !== "swap_v2")
    return null;
  const fail = () => {
    throw new Error(
      `Unverified transfer execution at ${root.instructionIndex}:${root.innerInstructionIndex ?? "top"}`,
    );
  };
  const height = root.innerInstructionIndex === null ? 1 : root.stackHeight;
  if (height === null) return fail();
  const children: Instruction[] = [];
  for (const ix of following) {
    if (
      ix.instructionIndex !== root.instructionIndex ||
      (ix.stackHeight !== null && ix.stackHeight <= height)
    )
      break;
    children.push(ix);
  }
  if (children.length !== 3) return fail();
  const [input, withdrawal, output] = children;
  const a = root.accounts;
  for (const role of [
    "user",
    "mint_in",
    "mint_out",
    "user_token_in",
    "user_token_out",
    "vault_token_in",
    "vault_token_out",
    "vault",
    "vault_authority",
    "withdraw_authority",
  ])
    if (!a[role]) return fail();
  if (
    a.mint_in === a.mint_out ||
    a.user_token_in === a.user_token_out ||
    a.token_program !== TOKEN ||
    a.vault_program !== VAULT ||
    input.stackHeight !== height + 1 ||
    withdrawal.stackHeight !== height + 1 ||
    output.stackHeight !== height + 2 ||
    withdrawal.programId !== VAULT ||
    withdrawal.instructionName !== "withdraw_v2"
  )
    return fail();
  const w = withdrawal.accounts;
  if (
    w.vault !== a.vault ||
    w.vault_authority !== a.vault_authority ||
    w.withdraw_authority !== a.withdraw_authority ||
    w.token_program !== TOKEN ||
    w.vault_token !== a.vault_token_out ||
    w.dest_token !== a.user_token_out ||
    w.mint !== a.mint_out ||
    rawAmount(withdrawal.args.beneficiary_amount) !== "0"
  )
    return fail();
  const transfer = (
    ix: Instruction,
    mint: string,
    source: string,
    destination: string,
    authority: string,
  ) => {
    if (
      source === destination ||
      ix.programId !== TOKEN ||
      ix.instructionName !== "transfer_checked" ||
      ix.accounts.mint !== mint ||
      ix.accounts.source_account !== source ||
      ix.accounts.destination_account !== destination ||
      ix.accounts.owner_or_delegate !== authority ||
      !Number.isInteger(tx.decimals[mint]) ||
      ix.args.decimals !== tx.decimals[mint]
    )
      return fail();
    const amount = rawAmount(ix.args.amount);
    if (BigInt(amount) <= 0n) return fail();
    return amount;
  };
  const amountIn = transfer(
    input,
    a.mint_in,
    a.user_token_in,
    a.vault_token_in,
    a.user,
  );
  const amountOut = transfer(
    output,
    a.mint_out,
    a.vault_token_out,
    a.user_token_out,
    a.vault_authority,
  );
  if (
    amountIn !== rawAmount(root.args.amount_in) ||
    amountOut !== rawAmount(withdrawal.args.amount)
  )
    return fail();
  return {
    type: "swap",
    parsedData: {
      input_mint: a.mint_in,
      output_mint: a.mint_out,
      in_amount: amountIn,
      actual_out_amount: amountOut,
      inner_swaps: [],
    },
  };
}
