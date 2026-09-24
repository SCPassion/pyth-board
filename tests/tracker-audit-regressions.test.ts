import { expect, it } from "vitest";
import evidence from "./fixtures/routers/audit-100-regressions.json";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import type { Transaction } from "../lib/tracker/types";
import { routerLabel } from "../lib/tracker/routers/registry";

const transaction = (prefix: string) =>
  structuredClone(
    evidence.find((tx) => tx.signature.startsWith(prefix))!,
  ) as unknown as Transaction;
const parse = (tx: Transaction) => parseTransaction(tx, DISCOVERED_PROGRAMS);

it.each([
  ["3f9uZ9", "BUY", "1530153247", "842265376"],
  ["3ku9Zc", "SELL", "6106233053", "3343894819"],
])(
  "parses independently RPC-verified Raydium swap_v2 %s",
  (prefix, side, pyth, sol) => {
    const result = parse(transaction(prefix));
    expect(result.review).toEqual([]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      router: "RAYDIUM_CLMM",
      side,
      pythAmountRaw: pyth,
      counterAmountRaw: sol,
      owner: "MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa",
      ownerConfidence: "MEDIUM",
    });
    expect(routerLabel(result.trades[0].router)).toBe("Raydium CLMM");
  },
);

it("collapses verified Raydium router legs into one economic sale", () => {
  const result = parse(transaction("2tEUj8"));
  expect(result.trades).toHaveLength(1);
  expect(result.review).toEqual([]);
  expect(result.trades[0]).toMatchObject({
    router: "RAYDIUM_ROUTER",
    side: "SELL",
    pythAmountRaw: "78003087",
    counterMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    counterAmountRaw: "4285675",
    owner: null,
    ownerConfidence: "UNRESOLVED",
  });
  expect(result.trades[0].routeLegs).toHaveLength(2);
  const tx = transaction("2tEUj8");
  tx.instructions[0].programId = "unverified-wrapper";
  expect(parse(tx).trades).toEqual([]);
  expect(parse(tx).review).toHaveLength(1);
});

it("parses the verified RFQ native settlement without automated-order attribution", () => {
  const result = parse(transaction("38UdYc"));
  expect(result.review).toEqual([]);
  expect(result.orders).toEqual([]);
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0]).toMatchObject({
    router: "JUPITER_RFQ",
    product: "SWAP",
    owner: null,
    pythAmountRaw: "3321245221",
    counterAmountRaw: "1824320105",
    routeLegs: [],
  });
});

it("uses OKX settlement transfers and excludes commission and refunded rent", () => {
  const tx = transaction("5uZVAo");
  const result = parse(tx);
  expect(result.review).toEqual([]);
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0]).toMatchObject({
    router: "OKX",
    owner: null,
    pythAmountRaw: "1000000",
    counterAmountRaw: "544688",
    routeLegs: [],
  });
  tx.instructions.find(
    (ix) => ix.instructionIndex === 3 && ix.innerInstructionIndex === 0,
  )!.programId = "unknown-setup-child";
  expect(parse(tx).trades).toEqual([]);
  expect(parse(tx).review).toHaveLength(2);
});

it("keeps unsupported Raydium execution formats in review", () => {
  const tx = transaction("3f9uZ9");
  const ix = tx.instructions.find((i) => i.instructionName === "swap_v2")!;
  ix.instructionName = "future_swap";
  expect(parse(tx).trades).toEqual([]);
  expect(parse(tx).review).toHaveLength(1);
});
