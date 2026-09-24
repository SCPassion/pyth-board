import { PYTH_MINT, ROUTER } from "../config";
import { rawAmount, record } from "../helius-format";
import type { Instruction, Transaction } from "../types";

const NINA = "NinafKYvKDCH26v6uEpfDjyuDjjpbdfhiPjrJV6FTFs";
const METEORA = "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB";
const VAULT = "24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi";
const E52 = "E52MR3wWQJG7mdBxLbw5tLcpF7DNzBWFKfacQ1HFSVrv";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const WHIRL = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const DAMM = "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG";
const CLMM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
const HP = "HpNfyc2Saw7RKkQd8nEL4khUcuPhQ7WwY1B2qjx8jxFq";
const check = (v: unknown) => {
  if (!v) throw new Error("Unverified wrapper cycle");
};
const amount = (v: unknown) => {
  const n = BigInt(rawAmount(v));
  check(n > 0n);
  return n;
};
function roles(ix: Instruction, expected: Record<string, string>) {
  for (const [k, v] of Object.entries(expected))
    check(v && ix.accounts[k] === v);
}
function shape(ix: Instruction, program: string, name: string, height: number) {
  check(
    ix.programId === program &&
      ix.instructionName === name &&
      ix.stackHeight === height,
  );
}
function transfer(
  ix: Instruction,
  source: string,
  destination: string,
  authority: string,
  height: number,
  mint?: string,
  decimals?: number,
) {
  shape(ix, TOKEN, mint ? "transfer_checked" : "transfer", height);
  roles(ix, {
    source_account: source,
    destination_account: destination,
    owner_or_delegate: authority,
  });
  check(source !== destination);
  if (mint) {
    roles(ix, { mint });
    check(Number.isInteger(decimals) && ix.args.decimals === decimals);
  }
  return amount(ix.args.amount);
}

type Leg = {
  input: string;
  output: string;
  owner: string;
  inputMint: string;
  outputMint: string;
  debit: bigint;
  credit: bigint;
  vaults: string[];
};
export function verifiedWrapperLeg(tx: Transaction, root: Instruction, c: Instruction[]): Leg {
  const a = root.accounts,
    d = record(root.summary?.parsedData),
    h = root.stackHeight!;
  check(h === 2 || h === 3);
  let input = a.input_token_account,
    output = a.output_token_account,
    owner = a.payer;
  let iv = a.input_vault,
    ov = a.output_vault,
    pool = a.pool_state;
  const inputMint = typeof d.input_mint === "string" ? d.input_mint : "";
  const outputMint = typeof d.output_mint === "string" ? d.output_mint : "";
  if (root.programId === METEORA) {
    shape(root, METEORA, "swap", h);
    check(
      c.length === 7 && a.token_program === TOKEN && a.vault_program === VAULT,
    );
    input = a.user_source_token;
    output = a.user_destination_token;
    owner = a.user;
    const [
      fee,
      deposit,
      depositTransfer,
      mint,
      withdraw,
      withdrawTransfer,
      burn,
    ] = c;
    shape(deposit, VAULT, "deposit", h + 1);
    shape(withdraw, VAULT, "withdraw", h + 1);
    const da = deposit.accounts,
      wa = withdraw.accounts;
    const side = da.vault === a.a_vault ? "a" : "b",
      other = side === "a" ? "b" : "a";
    roles(deposit, {
      vault: a[`${side}_vault`],
      token_vault: a[`${side}_token_vault`],
      lp_mint: a[`${side}_vault_lp_mint`],
      user_token: input,
      user_lp: a[`${side}_vault_lp`],
      user: owner,
      token_program: TOKEN,
    });
    roles(withdraw, {
      vault: a[`${other}_vault`],
      token_vault: a[`${other}_token_vault`],
      lp_mint: a[`${other}_vault_lp_mint`],
      user_token: output,
      user_lp: a[`${other}_vault_lp`],
      user: a[`${side}_vault_lp`],
      token_program: TOKEN,
    });
    const feeAmount = transfer(fee, input, a.protocol_token_fee, owner, h + 1);
    const deposited = transfer(
      depositTransfer,
      input,
      da.token_vault,
      owner,
      h + 2,
    );
    const credit = transfer(
      withdrawTransfer,
      wa.token_vault,
      output,
      wa.vault,
      h + 2,
    );
    check(deposited === amount(deposit.args.token_amount));
    shape(mint, TOKEN, "mint_to", h + 2);
    roles(mint, {
      mint: da.lp_mint,
      destination_account: da.user_lp,
      mint_authority: da.vault,
    });
    shape(burn, TOKEN, "burn", h + 2);
    roles(burn, {
      account: wa.user_lp,
      mint: wa.lp_mint,
      owner_or_delegate: wa.user,
    });
    amount(mint.args.amount);
    check(amount(burn.args.amount) === amount(withdraw.args.unmint_amount));
    const debit = feeAmount + deposited;
    check(
      debit === amount(root.args.in_amount) &&
        inputMint &&
        outputMint &&
        inputMint !== outputMint,
    );
    check(
      new Set([
        input,
        output,
        da.token_vault,
        wa.token_vault,
        a.protocol_token_fee,
      ]).size === 5,
    );
    return {
      input,
      output,
      owner,
      inputMint,
      outputMint,
      debit,
      credit,
      vaults: [
        da.token_vault,
        wa.token_vault,
        a.protocol_token_fee,
        da.user_lp,
        wa.user_lp,
      ],
    };
  }
  if (root.programId === WHIRL) {
    check(
      root.instructionName === "swap" || root.instructionName === "swap_v2",
    );
    check(
      typeof root.args.a_to_b === "boolean" &&
        root.args.amount_specified_is_input === true,
    );
    const i = root.args.a_to_b ? "a" : "b",
      o = root.args.a_to_b ? "b" : "a";
    input = a[`token_owner_account_${i}`];
    output = a[`token_owner_account_${o}`];
    iv = a[`token_vault_${i}`];
    ov = a[`token_vault_${o}`];
    owner = a.token_authority;
    pool = a.whirlpool;
    if (root.instructionName === "swap_v2")
      check(
        a.token_program_a === TOKEN &&
          a.token_program_b === TOKEN &&
          a[`token_mint_${i}`] === inputMint &&
          a[`token_mint_${o}`] === outputMint,
      );
    else check(a.token_program === TOKEN);
  } else if (root.programId === DAMM) {
    shape(root, DAMM, "swap", h);
    check(a.token_a_program === TOKEN && a.token_b_program === TOKEN);
    check(
      [a.token_a_mint, a.token_b_mint].includes(inputMint) &&
        [a.token_a_mint, a.token_b_mint].includes(outputMint),
    );
    iv = a[inputMint === a.token_a_mint ? "token_a_vault" : "token_b_vault"];
    ov = a[outputMint === a.token_a_mint ? "token_a_vault" : "token_b_vault"];
    pool = a.pool_authority;
  } else {
    check(root.programId === CLMM || root.programId === HP);
    shape(root, root.programId, "swap", h);
    check(a.token_program === TOKEN && root.args.is_base_input === true);
  }
  check(c.length === (root.programId === DAMM ? 3 : 2));
  const checked = root.programId === DAMM || root.instructionName === "swap_v2";
  const debit = transfer(
    c[0],
    input,
    iv,
    owner,
    h + 1,
    checked ? inputMint : undefined,
    tx.decimals[inputMint],
  );
  const credit = transfer(
    c[1],
    ov,
    output,
    pool,
    h + 1,
    checked ? outputMint : undefined,
    tx.decimals[outputMint],
  );
  check(new Set([input, output, iv, ov]).size === 4);
  const requested =
    root.programId === DAMM
      ? record(root.args._params).amount_in
      : root.args.amount;
  check(debit === amount(requested));
  if (root.programId !== HP)
    check(
      root.summary?.type === "swap" &&
        debit === amount(d.in_amount) &&
        credit === amount(d.actual_out_amount) &&
        inputMint !== outputMint,
    );
  else check(!root.summary);
  if (root.programId === DAMM) {
    shape(c[2], DAMM, "EvtSwap2", h + 1);
    check(c[2].args.pool === a.pool);
    check(
      amount(c[2].args.included_transfer_fee_amount_in) === debit &&
        amount(c[2].args.excluded_transfer_fee_amount_out) === credit,
    );
  }
  return {
    input,
    output,
    owner,
    inputMint,
    outputMint,
    debit,
    credit,
    vaults: [iv, ov],
  };
}

/** Exclusion only: exact observed wrapper shapes, complete CPI transfer paths,
 * one authority and account-continuous cycle. No wrapper-wide trust or owner
 * attribution. Any extra call, fee, residual or missing evidence stays review. */
export function verifiedWrapperCycle(
  tx: Transaction,
  root: Instruction,
  children: Instruction[],
): boolean {
  if (root.programId !== E52 && root.programId !== NINA) return false;
  try {
    check(tx.decimals[PYTH_MINT] === 6);
    check(
      root.innerInstructionIndex === null &&
        root.stackHeight === 1 &&
        !root.summary &&
        root.instructionName === null,
    );
    check(
      children.every(
        (ix, i) =>
          ix.instructionIndex === root.instructionIndex &&
          ix.innerInstructionIndex === i,
      ),
    );
    const nina = root.programId === NINA;
    let jupiter: Instruction | undefined;
    if (nina) {
      jupiter = children[0];
      shape(jupiter, ROUTER, "route", 2);
      check(
        jupiter.accounts.token_program === TOKEN &&
          jupiter.args.platform_fee_bps === 0 &&
          jupiter.summary?.type === "swap",
      );
      children = children.slice(1);
    }
    const height = nina ? 3 : 2;
    const groups: {
      root: Instruction;
      children: Instruction[];
      event?: Instruction;
    }[] = [];
    for (const ix of children) {
      if (nina && ix.programId === ROUTER && ix.stackHeight === height) {
        shape(ix, ROUTER, "SwapEvent", height);
        check(groups.length && !groups.at(-1)!.event);
        groups.at(-1)!.event = ix;
      } else if (ix.stackHeight === height)
        groups.push({ root: ix, children: [] });
      else {
        check(groups.length > 0 && !groups.at(-1)!.event);
        groups.at(-1)!.children.push(ix);
      }
    }
    const programs = groups.map((g) => g.root.programId).join(",");
    check(
      nina
        ? programs === [WHIRL, DAMM, METEORA, METEORA].join(",")
        : programs === [CLMM, DAMM, DAMM, WHIRL].join(",") ||
            programs === [HP, WHIRL, WHIRL, WHIRL].join(","),
    );
    const legs = groups.map((g) => verifiedWrapperLeg(tx, g.root, g.children));
    if (jupiter) {
      const d = record(jupiter.summary?.parsedData),
        first = legs[0],
        last = legs.at(-1)!;
      roles(jupiter, {
        user_transfer_authority: first.owner,
        user_source_token_account: first.input,
        user_destination_token_account: last.output,
        destination_mint: last.outputMint,
      });
      check(
        d.input_mint === first.inputMint &&
          d.output_mint === last.outputMint &&
          amount(d.in_amount) === first.debit &&
          amount(d.actual_out_amount) === last.credit,
      );
      for (const [i, g] of groups.entries()) {
        check(g.event);
        const e = g.event!.args,
          l = legs[i];
        check(
          e.amm === g.root.programId &&
            e.input_mint === l.inputMint &&
            e.output_mint === l.outputMint &&
            amount(e.input_amount) === l.debit &&
            amount(e.output_amount) === l.credit,
        );
      }
    }
    if (legs[0].inputMint === "") {
      legs[0].inputMint = legs.at(-1)!.outputMint;
      legs[0].outputMint = legs[1].inputMint;
    }
    check(legs[0].inputMint && legs[0].inputMint !== PYTH_MINT);
    check(
      new Set(legs.map((l) => l.input)).size === 4 &&
        new Set(legs.map((l) => l.inputMint)).size === 4,
    );
    check(legs.some((l) => l.inputMint === PYTH_MINT));
    const userAccounts = new Set(legs.map((l) => l.input));
    for (const [i, l] of legs.entries()) {
      const next = legs[(i + 1) % legs.length];
      check(
        l.owner === legs[0].owner &&
          l.output === next.input &&
          l.outputMint === next.inputMint,
      );
      check(l.vaults.every((v) => !userAccounts.has(v)));
      if (i < legs.length - 1) check(l.credit === next.debit);
    }
    return true;
  } catch {
    return false;
  }
}
