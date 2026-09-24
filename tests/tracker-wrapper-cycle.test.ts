import { expect, it } from "vitest";
import evidence from "./fixtures/routers/wrapper-cycle-evidence.json";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import type { Transaction } from "../lib/tracker/types";
const tx = (prefix: string) =>
  structuredClone(
    evidence.find((t) => t.signature.startsWith(prefix))!,
  ) as unknown as Transaction;
const parse = (t: Transaction) => parseTransaction(t, DISCOVERED_PROGRAMS);
const root = (t: Transaction) =>
  t.instructions.find(
    (i) =>
      i.innerInstructionIndex === null &&
      ["E52", "Nina"].some((p) => i.programId.startsWith(p)),
  )!;
const transfer = (t: Transaction) =>
  t.instructions.find(
    (i) =>
      i.instructionName === "transfer" ||
      i.instructionName === "transfer_checked",
  )!;
for (const prefix of ["5PZN", "2vE7", "5zRi"]) {
  it(`${prefix} excludes the complete account-continuous non-PYTH cycle`, () => {
    const t = tx(prefix),
      before = structuredClone(t);
    expect(parse(t)).toEqual({ trades: [], orders: [], review: [] });
    expect(t).toEqual(before);
  });
  const changes: [string, (t: Transaction) => void][] = [
    [
      "missing transfer",
      (t) => {
        t.instructions.splice(t.instructions.indexOf(transfer(t)), 1);
      },
    ],
    [
      "wrong authority",
      (t) => {
        transfer(t).accounts.owner_or_delegate = "unrelated";
      },
    ],
    [
      "different recipient",
      (t) => {
        transfer(t).accounts.destination_account = "unrelated";
      },
    ],
    [
      "changed executed amount",
      (t) => {
        transfer(t).args.amount = "1";
      },
    ],
    [
      "unsafe integer",
      (t) => {
        transfer(t).args.amount = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      "unknown ancestry",
      (t) => {
        transfer(t).stackHeight = null;
      },
    ],
    [
      "token extensions",
      (t) => {
        transfer(t).programId = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
      },
    ],
    [
      "unverified wrapper",
      (t) => {
        root(t).programId = "unknown-wrapper";
      },
    ],
    [
      "additional fee transfer",
      (t) => {
        const r = root(t),
          c = t.instructions.filter(
            (i) => i.instructionIndex === r.instructionIndex,
          );
        t.instructions.splice(t.instructions.indexOf(c.at(-1)!) + 1, 0, {
          ...transfer(t),
          innerInstructionIndex: c.length - 1,
          stackHeight: 2,
        });
      },
    ],
  ];
  it.each(changes)(`${prefix} keeps %s in review`, (_, change) => {
    const t = tx(prefix);
    change(t);
    expect(parse(t).trades).toEqual([]);
    expect(parse(t).review).toHaveLength(1);
  });
}
it("Nina requires the actual vault fee, deposit and withdrawal to agree with route events", () => {
  for (const name of ["deposit", "withdraw", "SwapEvent"]) {
    const t = tx("5zRi");
    const i = t.instructions.find((i) => i.instructionName === name)!;
    if (name === "deposit") i.accounts.user_token = "different-account";
    if (name === "withdraw") i.args.unmint_amount = "1";
    if (name === "SwapEvent") i.args.output_amount = "1";
    expect(parse(t).review).toHaveLength(1);
  }
});
it("retains G2E4 separately: matching swap summaries conceal a PYTH host fee", () => {
  const t = tx("5Yot");
  const refund = t.instructions.find(
    (i) => i.instructionIndex === 1 && i.innerInstructionIndex === 9,
  )!;
  expect(refund.accounts.mint).toBe(
    "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  );
  expect(refund.args.amount).toBe("38869");
  expect(parse(t).trades).toEqual([]);
  expect(parse(t).review).toEqual([]);
  expect(parse(t).arbitrages).toHaveLength(1);
});
it("does not swallow an independent sibling execution", () => {
  const t = tx("5PZN");
  const sibling = structuredClone(
    t.instructions.find(
      (i) => i.programId.startsWith("whirL") && i.instructionName === "swap",
    )!,
  );
  sibling.instructionIndex = 4;
  sibling.innerInstructionIndex = null;
  sibling.stackHeight = 1;
  t.instructions.push(sibling);
  const r = parse(t);
  expect(r.review).toEqual([]);
  expect(r.trades).toHaveLength(1);
});
