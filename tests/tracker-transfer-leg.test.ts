import { expect, it } from "vitest";
import fixture from "./fixtures/routers/titan-transfer-leg.json";
import type { Transaction } from "../lib/tracker/types";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";

const transaction = () => structuredClone(fixture) as unknown as Transaction;
const parse = (tx: Transaction) => parseTransaction(tx, DISCOVERED_PROGRAMS);
it("recovers the exact executed Titan leg without inventing an owner", () => {
  const tx = transaction();
  const before = JSON.stringify(tx);
  const r = parse(tx);
  expect(r.review).toEqual([]);
  expect(r.trades).toHaveLength(1);
  expect(r.trades[0]).toMatchObject({
    router: "TITAN",
    side: "SELL",
    pythAmountRaw: "1000",
    counterMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    counterAmountRaw: "58",
    owner: null,
    ownerConfidence: "UNRESOLVED",
  });
  expect(r.trades[0].routeLegs).toHaveLength(3);
  expect(r.trades[0].routeLegs[1]).toMatchObject({
    inputAmountRaw: "230",
    outputAmountRaw: "43",
  });
  expect(r.trades[0].flags).toContain("TRANSFER_VERIFIED_ROUTE_LEG");
  expect(JSON.stringify(tx)).toBe(before);
});

it.each([
  "missing-transfer",
  "extra-cpi",
  "wrong-source",
  "wrong-mint",
  "wrong-authority",
  "unknown-ancestry",
  "token-2022",
  "amount-mismatch",
  "withdrawal-fee",
  "unknown-version",
  "missing-role",
  "wrong-decimals",
])("keeps %s evidence in review", (mutation) => {
  const tx = transaction();
  const leg = tx.instructions.find((i) => i.programId.startsWith("swapFp"))!;
  const withdrawal = tx.instructions.find(
    (i) => i.instructionName === "withdraw_v2",
  )!;
  const output = tx.instructions.find((i) => i.innerInstructionIndex === 7)!;
  switch (mutation) {
    case "missing-transfer":
      tx.instructions.splice(tx.instructions.indexOf(output), 1);
      break;
    case "extra-cpi":
      tx.instructions.splice(tx.instructions.indexOf(output), 0, {
        ...output,
        programId: "unknown-program",
      });
      break;
    case "wrong-source":
      output.accounts.source_account = "unrelated-account";
      break;
    case "wrong-mint":
      output.accounts.mint = leg.accounts.mint_in;
      break;
    case "wrong-authority":
      output.accounts.owner_or_delegate = leg.accounts.user;
      break;
    case "unknown-ancestry":
      output.stackHeight = null;
      break;
    case "token-2022":
      output.programId = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
      break;
    case "amount-mismatch":
      output.args.amount = "44";
      break;
    case "withdrawal-fee":
      withdrawal.args.beneficiary_amount = "1";
      break;
    case "unknown-version":
      leg.instructionName = "swap_v3";
      break;
    case "missing-role":
      delete leg.accounts.vault_authority;
      break;
    case "wrong-decimals":
      output.args.decimals = 9;
      break;
  }
  expect(parse(tx).trades).toEqual([]);
  expect(parse(tx).review).toHaveLength(1);
});
