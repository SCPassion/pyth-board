import { PYTH_MINT } from "../config";
import { rawAmount, record } from "../helius-format";
import type { Instruction, Transaction } from "../types";

export const RFQ = "61DFfeTKM7trxYcPQCM78bJ794ddZprZpAwAnLiwTpYH";
const OKX = "proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SYSTEM = "11111111111111111111111111111111";
const SOL = "So11111111111111111111111111111111111111112";
const requireEvidence = (condition: unknown) => {
  if (!condition) throw new Error("Unverified router settlement");
};
function accounts(ix: Instruction, expected: Record<string, string>) {
  for (const [key, value] of Object.entries(expected))
    requireEvidence(value && ix.accounts[key] === value);
}
function shape(ix: Instruction, program: string, name: string, height: number) {
  requireEvidence(
    ix.programId === program &&
      ix.instructionName === name &&
      ix.stackHeight === height,
  );
}
function positive(value: unknown) {
  const amount = BigInt(rawAmount(value));
  requireEvidence(amount > 0n);
  return amount;
}
function summary(input: bigint, output: bigint): Instruction["summary"] {
  return {
    type: "swap",
    parsedData: {
      input_mint: PYTH_MINT,
      output_mint: SOL,
      in_amount: input.toString(),
      actual_out_amount: output.toString(),
      inner_swaps: [],
    },
  };
}

/** Only the observed PYTH → native SOL fill variant. Actual token and native
 * transfers must match; maker-funded rent returns to the maker, not the taker. */
function rfqSettlement(root: Instruction, c: Instruction[]) {
  requireEvidence(root.instructionName === "fill" && c.length === 6);
  const a = root.accounts;
  requireEvidence(
    a.input_mint === PYTH_MINT &&
      a.output_mint === SOL &&
      a.input_token_program === TOKEN &&
      a.output_token_program === TOKEN &&
      a.system_program === SYSTEM &&
      a.taker !== a.maker &&
      a.taker_output_mint_token_account === RFQ,
  );
  const names = [
    "transfer",
    "create_account",
    "initialize_account_3",
    "transfer",
    "close_account",
    "transfer",
  ];
  c.forEach((ix, i) =>
    shape(ix, i === 1 || i === 5 ? SYSTEM : TOKEN, names[i], 2),
  );
  accounts(c[0], {
    source_account: a.taker_input_mint_token_account,
    destination_account: a.maker_input_mint_token_account,
    owner_or_delegate: a.taker,
  });
  requireEvidence(
    a.taker_input_mint_token_account !== a.maker_input_mint_token_account,
  );
  const temporary = c[1].accounts.new_account;
  requireEvidence(
    temporary &&
      ![
        a.taker,
        a.maker,
        a.maker_output_mint_token_account,
        a.taker_input_mint_token_account,
        a.maker_input_mint_token_account,
      ].includes(temporary),
  );
  accounts(c[1], { funding_account: a.maker });
  requireEvidence(
    c[1].args.owner === TOKEN && rawAmount(c[1].args.space) === "165",
  );
  positive(c[1].args.lamports);
  accounts(c[2], { account: temporary, mint: SOL });
  requireEvidence(c[2].args.owner === a.maker);
  accounts(c[3], {
    source_account: a.maker_output_mint_token_account,
    destination_account: temporary,
    owner_or_delegate: a.maker,
  });
  accounts(c[4], { account: temporary, destination: a.maker, owner: a.maker });
  accounts(c[5], { funding_account: a.maker, recipient_account: a.taker });
  const input = positive(c[0].args.amount),
    output = positive(c[5].args.lamports);
  requireEvidence(
    input === positive(root.args.input_amount) &&
      output === positive(c[3].args.amount) &&
      output === positive(root.args.output_amount),
  );
  return summary(input, output);
}

/** Verify the temporary wrapped-SOL account and customer payout without
 * depending on the identities or number of inner pool programs. */
function okxNativeSettlement(
  tx: Transaction,
  root: Instruction,
  c: Instruction[],
) {
  const a = root.accounts;
  const args = record(root.args.args);
  requireEvidence(
    c.length >= 5 &&
      c.length <= 128 &&
      c.every((ix) => ix.stackHeight !== null) &&
      a.source_mint === PYTH_MINT &&
      a.destination_mint === SOL &&
      a.source_token_program === TOKEN &&
      a.destination_token_program === TOKEN &&
      a.system_program === SYSTEM &&
      a.program === OKX &&
      a.payer &&
      a.sa_authority &&
      a.payer !== a.sa_authority &&
      new Set([
        a.source_token_account,
        a.source_token_sa,
        a.destination_token_sa,
        a.destination_token_account,
        a.payer,
        a.sa_authority,
        a.commission_account,
      ]).size === 7,
  );
  const last = c.at(-1)!;
  shape(last, OKX, "SwapWithFeesCpiEventEnhanced2", 2);
  const event = last.args;
  requireEvidence(
    event.source_mint === PYTH_MINT &&
      event.destination_mint === SOL &&
      event.source_token_account_owner === a.payer &&
      event.destination_token_account_owner === a.payer &&
      event.commission_direction === false &&
      event.commission_account === a.commission_account &&
      rawAmount(event.order_id) === rawAmount(args.order_id) &&
      event.platform_fee_rate === root.args.platform_fee_rate,
  );
  const direct = c.filter((ix) => ix.stackHeight === 2);
  const customerTouches = c.filter(
    (ix) =>
      ix.programId === TOKEN &&
      [a.source_token_account, a.destination_token_account].some((account) =>
        Object.values(ix.accounts).includes(account),
      ),
  );
  const input = customerTouches.filter(
    (ix) =>
      ix.stackHeight === 2 &&
      ix.instructionName === "transfer_checked" &&
      ix.accounts.source_account === a.source_token_account &&
      ix.accounts.destination_account === a.source_token_sa &&
      ix.accounts.mint === PYTH_MINT &&
      ix.accounts.owner_or_delegate === a.payer &&
      ix.args.decimals === 6,
  );
  const grossTransfer = customerTouches.filter(
    (ix) =>
      ix.stackHeight === 2 &&
      ix.instructionName === "transfer_checked" &&
      ix.accounts.source_account === a.destination_token_sa &&
      ix.accounts.destination_account === a.destination_token_account &&
      ix.accounts.mint === SOL &&
      ix.accounts.owner_or_delegate === a.sa_authority &&
      ix.args.decimals === 9,
  );
  const close = customerTouches.filter(
    (ix) =>
      ix.stackHeight === 2 &&
      ix.instructionName === "close_account" &&
      ix.accounts.account === a.destination_token_account &&
      ix.accounts.destination === a.sa_authority &&
      ix.accounts.owner === a.payer,
  );
  requireEvidence(
    input.length === 1 &&
      grossTransfer.length === 1 &&
      close.length === 1 &&
      customerTouches.length === 3 &&
      direct.indexOf(input[0]) < direct.indexOf(grossTransfer[0]) &&
      direct.indexOf(grossTransfer[0]) < direct.indexOf(close[0]) &&
      direct.indexOf(close[0]) < direct.indexOf(last),
  );
  const inAmount = positive(input[0].args.amount);
  const gross = positive(grossTransfer[0].args.amount);
  const net = positive(event.destination_token_change);
  requireEvidence(
    inAmount === positive(args.amount_in) &&
      inAmount === positive(event.amount_in) &&
      inAmount === positive(event.source_token_change),
  );
  const fees: [string, bigint][] = [];
  for (const [recipient, raw] of [
    [event.commission_account, event.commission_amount],
    [event.trim_account, event.trim_amount],
    [event.charge_account, event.charge_amount],
    [event.platform_fee_account, event.platform_fee_amount],
  ]) {
    const amount = BigInt(rawAmount(raw));
    if (amount > 0n) {
      requireEvidence(typeof recipient === "string" && recipient.length > 0);
      fees.push([recipient as string, amount]);
    }
  }
  requireEvidence(
    gross - fees.reduce((sum, [, amount]) => sum + amount, 0n) === net,
  );

  // This account was created and funded by the customer immediately before
  // the swap; its returned rent is excluded from the executed output.
  const before = tx.instructions.filter(
    (ix) => ix.instructionIndex < root.instructionIndex,
  );
  const touching = before.filter((ix) =>
    Object.values(ix.accounts).includes(a.destination_token_account),
  );
  requireEvidence(touching.length === 5);
  const [fund, setup, allocate, assign, initialize] = touching;
  shape(fund, SYSTEM, "transfer", 1);
  shape(setup, OKX, "create_token_account", 1);
  shape(allocate, SYSTEM, "allocate", 2);
  shape(assign, SYSTEM, "assign", 2);
  shape(initialize, TOKEN, "initialize_account_3", 2);
  requireEvidence(
    fund.innerInstructionIndex === null &&
      setup.innerInstructionIndex === null &&
      fund.instructionIndex < setup.instructionIndex &&
      [allocate, assign, initialize].every(
        (ix) => ix.instructionIndex === setup.instructionIndex,
      ) &&
      tx.instructions.filter(
        (ix) => ix.instructionIndex === setup.instructionIndex,
      ).length === 4,
  );
  accounts(fund, {
    funding_account: a.payer,
    recipient_account: a.destination_token_account,
  });
  accounts(setup, {
    payer: a.payer,
    owner: a.payer,
    token_account: a.destination_token_account,
    token_mint: SOL,
    token_program: TOKEN,
    system_program: SYSTEM,
  });
  accounts(allocate, { new_account: a.destination_token_account });
  requireEvidence(rawAmount(allocate.args.space) === "165");
  accounts(assign, { account: a.destination_token_account });
  requireEvidence(assign.args.owner === TOKEN);
  accounts(initialize, { account: a.destination_token_account, mint: SOL });
  requireEvidence(initialize.args.owner === a.payer);

  const payout = net + positive(fund.args.lamports);
  const expected: [string, bigint][] = [[a.payer, payout], ...fees];
  const nativeTransfers = direct.filter(
    (ix) => ix.accounts.funding_account === a.sa_authority,
  );
  requireEvidence(nativeTransfers.length === expected.length);
  const remaining = [...nativeTransfers];
  for (const [recipient, amount] of expected) {
    const index = remaining.findIndex(
      (ix) =>
        ix.programId === SYSTEM &&
        ix.instructionName === "transfer" &&
        ix.accounts.recipient_account === recipient &&
        positive(ix.args.lamports) === amount &&
        direct.indexOf(ix) > direct.indexOf(close[0]) &&
        direct.indexOf(ix) < direct.indexOf(last),
    );
    requireEvidence(index >= 0);
    remaining.splice(index, 1);
  }
  return summary(inAmount, net);
}

/** Verify customer endpoints and every output fee transfer. The pool subtree
 * may contain any programs; none of them defines the customer's trade amount. */
function okxTokenSettlement(
  tx: Transaction,
  root: Instruction,
  c: Instruction[],
) {
  const a = root.accounts;
  const args = record(root.args.args);
  requireEvidence(
    c.length >= 3 &&
      c.length <= 128 &&
      c.every((ix) => ix.stackHeight !== null) &&
      a.program === OKX &&
      a.system_program === SYSTEM &&
      a.source_token_program === TOKEN &&
      a.destination_token_program === TOKEN &&
      a.source_mint !== a.destination_mint &&
      [a.source_mint, a.destination_mint].includes(PYTH_MINT) &&
      a.source_mint !== SOL &&
      a.destination_mint !== SOL &&
      a.payer &&
      a.sa_authority &&
      a.payer !== a.sa_authority &&
      new Set([
        a.source_token_account,
        a.destination_token_account,
        a.source_token_sa,
        a.destination_token_sa,
      ]).size === 4,
  );
  const sourceDecimals = tx.decimals[a.source_mint];
  const destinationDecimals = tx.decimals[a.destination_mint];
  requireEvidence(
    Number.isInteger(sourceDecimals) && Number.isInteger(destinationDecimals),
  );
  const last = c.at(-1)!;
  shape(last, OKX, "SwapWithFeesCpiEventEnhanced2", 2);
  const event = last.args;
  requireEvidence(
    event.source_mint === a.source_mint &&
      event.destination_mint === a.destination_mint &&
      event.source_token_account_owner === a.payer &&
      event.destination_token_account_owner === a.payer &&
      event.commission_direction === false &&
      event.commission_account === a.commission_account &&
      rawAmount(event.order_id) === rawAmount(args.order_id) &&
      event.platform_fee_rate === root.args.platform_fee_rate,
  );
  const direct = c.filter((ix) => ix.stackHeight === 2);
  const customerTouches = c.filter(
    (ix) =>
      ix.programId === TOKEN &&
      [a.source_token_account, a.destination_token_account].some((account) =>
        Object.values(ix.accounts).includes(account),
      ),
  );
  const input = customerTouches.filter(
    (ix) =>
      ix.stackHeight === 2 &&
      ix.instructionName === "transfer_checked" &&
      ix.accounts.source_account === a.source_token_account &&
      ix.accounts.destination_account === a.source_token_sa &&
      ix.accounts.mint === a.source_mint &&
      ix.accounts.owner_or_delegate === a.payer &&
      ix.args.decimals === sourceDecimals,
  );
  const output = customerTouches.filter(
    (ix) =>
      ix.stackHeight === 2 &&
      ix.instructionName === "transfer_checked" &&
      ix.accounts.source_account === a.destination_token_sa &&
      ix.accounts.destination_account === a.destination_token_account &&
      ix.accounts.mint === a.destination_mint &&
      ix.accounts.owner_or_delegate === a.sa_authority &&
      ix.args.decimals === destinationDecimals,
  );
  requireEvidence(
    input.length === 1 &&
      output.length === 1 &&
      customerTouches.length === 2 &&
      direct.indexOf(input[0]) < direct.indexOf(output[0]) &&
      direct.indexOf(output[0]) < direct.indexOf(last),
  );
  const inAmount = positive(input[0].args.amount);
  const outAmount = positive(output[0].args.amount);
  requireEvidence(
    inAmount === positive(args.amount_in) &&
      inAmount === positive(event.amount_in) &&
      inAmount === positive(event.source_token_change) &&
      outAmount === positive(event.destination_token_change),
  );
  const expected: [string, bigint][] = [
    [a.destination_token_account, outAmount],
  ];
  for (const [recipient, raw] of [
    [event.commission_account, event.commission_amount],
    [event.trim_account, event.trim_amount],
    [event.charge_account, event.charge_amount],
    [event.platform_fee_account, event.platform_fee_amount],
  ]) {
    const amount = BigInt(rawAmount(raw));
    if (amount > 0n) {
      requireEvidence(typeof recipient === "string" && recipient.length > 0);
      expected.push([recipient as string, amount]);
    }
  }
  const payouts = direct.filter(
    (ix) => ix.accounts.source_account === a.destination_token_sa,
  );
  requireEvidence(payouts.length === expected.length);
  const remaining = [...payouts];
  for (const [recipient, amount] of expected) {
    const index = remaining.findIndex(
      (ix) =>
        ix.programId === TOKEN &&
        ix.instructionName === "transfer_checked" &&
        ix.accounts.mint === a.destination_mint &&
        ix.accounts.destination_account === recipient &&
        ix.accounts.owner_or_delegate === a.sa_authority &&
        ix.args.decimals === destinationDecimals &&
        positive(ix.args.amount) === amount,
    );
    requireEvidence(index >= 0);
    remaining.splice(index, 1);
  }
  return {
    type: "swap",
    parsedData: {
      input_mint: a.source_mint,
      output_mint: a.destination_mint,
      in_amount: inAmount.toString(),
      actual_out_amount: outAmount.toString(),
      inner_swaps: [],
    },
  };
}

export function settlementSummary(
  tx: Transaction,
  root: Instruction,
  children: Instruction[],
): Instruction["summary"] {
  const rfq = root.programId === RFQ;
  const okx =
    root.programId === OKX && root.instructionName === "swap_tob_enhanced";
  if (!rfq && !okx) return null;
  requireEvidence(
    root.innerInstructionIndex === null &&
      root.stackHeight === 1 &&
      tx.decimals[PYTH_MINT] === 6,
  );
  if (
    okx &&
    root.accounts.source_mint !== SOL &&
    root.accounts.destination_mint !== SOL
  )
    return okxTokenSettlement(tx, root, children);
  requireEvidence(tx.decimals[SOL] === 9);
  return rfq
    ? rfqSettlement(root, children)
    : okxNativeSettlement(tx, root, children);
}
