import { expect, it } from "vitest";
import evidence from "./fixtures/routers/audit-100-regressions.json";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import type { Transaction } from "../lib/tracker/types";
const transaction = (prefix: string) =>
  structuredClone(
    evidence.find((tx) => tx.signature.startsWith(prefix))!,
  ) as unknown as Transaction;
const parse = (tx: Transaction) => parseTransaction(tx, DISCOVERED_PROGRAMS);

type Change = [string, (tx: Transaction) => void];
const root = (tx: Transaction) =>
  tx.instructions.find(
    (i) =>
      i.instructionName === "fill" || i.instructionName === "swap_tob_enhanced",
  )!;
const child = (tx: Transaction, n: number) =>
  tx.instructions.find(
    (i) =>
      i.instructionIndex === root(tx).instructionIndex &&
      i.innerInstructionIndex === n,
  )!;
const rfqChanges: Change[] = [
  [
    "wrong native recipient",
    (tx) => {
      child(tx, 5).accounts.recipient_account = "stranger";
    },
  ],
  [
    "wrong token recipient",
    (tx) => {
      child(tx, 0).accounts.destination_account = "stranger";
    },
  ],
  [
    "wrong authority",
    (tx) => {
      child(tx, 0).accounts.owner_or_delegate = "stranger";
    },
  ],
  [
    "unmatched native amount",
    (tx) => {
      child(tx, 5).args.lamports = "1";
    },
  ],
  [
    "wrong unwrap destination",
    (tx) => {
      child(tx, 4).accounts.destination = "stranger";
    },
  ],
  [
    "wrong mint",
    (tx) => {
      child(tx, 2).accounts.mint = root(tx).accounts.input_mint;
    },
  ],
  [
    "token extensions",
    (tx) => {
      child(tx, 0).programId = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
    },
  ],
  [
    "unknown instruction variant",
    (tx) => {
      root(tx).instructionName = "future_fill";
    },
  ],
  [
    "missing transfer",
    (tx) => {
      tx.instructions.splice(tx.instructions.indexOf(child(tx, 5)), 1);
    },
  ],
];
const okxChanges: Change[] = [
  [
    "wrong fee recipient",
    (tx) => {
      child(tx, 20).accounts.recipient_account = "stranger";
    },
  ],
  [
    "wrong payout recipient",
    (tx) => {
      child(tx, 21).accounts.recipient_account = "stranger";
    },
  ],
  [
    "unmatched fee",
    (tx) => {
      child(tx, 20).args.lamports = "1";
    },
  ],
  [
    "gross output in event",
    (tx) => {
      child(tx, 22).args.destination_token_change = "549136";
    },
  ],
  [
    "unmatched rent refund",
    (tx) => {
      child(tx, 21).args.lamports = "544688";
    },
  ],
  [
    "wrong token destination",
    (tx) => {
      child(tx, 18).accounts.destination_account = "stranger";
    },
  ],
  [
    "wrong source mint",
    (tx) => {
      child(tx, 0).accounts.mint = "stranger";
    },
  ],
  [
    "wrong token decimals",
    (tx) => {
      child(tx, 18).args.decimals = 6;
    },
  ],
  [
    "unmatched input",
    (tx) => {
      child(tx, 0).args.amount = "999999";
    },
  ],
  [
    "input commission",
    (tx) => {
      child(tx, 22).args.commission_direction = true;
    },
  ],
  [
    "trim fee",
    (tx) => {
      child(tx, 22).args.trim_amount = "1";
    },
  ],
  [
    "wrong event program",
    (tx) => {
      child(tx, 22).programId = "stranger";
    },
  ],
  [
    "missing event",
    (tx) => {
      tx.instructions.splice(tx.instructions.indexOf(child(tx, 22)), 1);
    },
  ],
  [
    "wrong setup owner",
    (tx) => {
      tx.instructions.find(
        (i) => i.instructionName === "initialize_account_3",
      )!.args.owner = "stranger";
    },
  ],
  [
    "extra customer debit in pool",
    (tx) => {
      child(tx, 6).accounts.source_account =
        root(tx).accounts.source_token_account;
    },
  ],
];
for (const [prefix, changes] of [
  ["38Ud", rfqChanges],
  ["5uZV", okxChanges],
] as const) {
  it.each(changes)(`${prefix} rejects %s`, (_, change) => {
    const tx = transaction(prefix);
    change(tx);
    const r = parse(tx);
    expect(r.trades).toEqual([]);
    expect(r.review.length).toBeGreaterThan(0);
  });
  it(`${prefix} rejects unknown ancestry and additional CPIs`, () => {
    const tx = transaction(prefix);
    child(tx, 0).stackHeight = null;
    expect(parse(tx).trades).toEqual([]);
    expect(parse(tx).review.length).toBeGreaterThan(0);
    const extra = transaction(prefix);
    extra.instructions.push({ ...child(extra, 0), innerInstructionIndex: 99 });
    expect(parse(extra).trades).toEqual([]);
    expect(parse(extra).review.length).toBeGreaterThan(0);
  });
  it(`${prefix} preserves input and ignores failed transactions`, () => {
    const tx = transaction(prefix),
      copy = structuredClone(tx);
    expect(parse(tx).trades).toHaveLength(1);
    expect(tx).toEqual(copy);
    tx.success = false;
    expect(parse(tx)).toEqual({ trades: [], orders: [], review: [] });
  });
}

it("keeps a verified OKX native settlement when an inner pool is unfamiliar", () => {
  const tx = transaction("5uZV");
  child(tx, 5).programId = "unfamiliar-pool-program";
  const result = parse(tx);
  expect(result.review).toEqual([]);
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0]).toMatchObject({
    router: "OKX",
    side: "SELL",
    pythAmountRaw: "1000000",
    counterAmountRaw: "544688",
  });
});
