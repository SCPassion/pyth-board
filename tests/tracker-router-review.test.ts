import { it, expect } from "vitest";
import dflow from "./fixtures/routers/dflow-wrap-buy.json";
import archer from "./fixtures/routers/titan-archer-review.json";
import flux from "./fixtures/routers/titan-flux-review.json";
import drv from "./fixtures/routers/titan-drv-review.json";
import okxBuy from "./fixtures/routers/okx-mixed-pools-buy.json";
import okxSell from "./fixtures/routers/okx-mixed-pools-sell.json";
import { decodeHelius } from "../lib/tracker/helius-format";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { genericRouters } from "../lib/tracker/routers/execution";
import { fixtureTransaction } from "./tracker-fixture";
const parse = (raw: unknown) =>
  parseTransaction(fixtureTransaction(raw), DISCOVERED_PROGRAMS);
it("decodes a complete DFlow split buy while holding it from publication", () => {
  const r = parse(dflow);
  expect(r.trades).toEqual([]);
  expect(r.review).toHaveLength(1);
  expect(r.review[0]).toContain("DFLOW: held outside initial router scope");
  expect(genericRouters(decodeHelius(dflow)).trades[0]).toMatchObject({
    router: "DFLOW",
    side: "BUY",
    pythAmountRaw: "7239202089",
    counterAmountRaw: "3966000000",
  });
});
it.each([
  [archer, "Archer8"],
  [flux, "FLUX6"],
  [drv, "DRVSp"],
])(
  "retains unknown Titan branches with actionable program evidence",
  (raw, program) => {
    const r = parse(raw);
    expect(r.trades).toEqual([]);
    expect(r.review).toHaveLength(1);
    expect(r.review[0]).toContain(program);
  },
);
it("does not let a setup instruction hide an unknown CPI", () => {
  const tx = decodeHelius(dflow);
  const wrap = tx.instructions.find((ix) => ix.instructionName === "wrap_sol")!;
  const child = tx.instructions.find(
    (ix) =>
      ix.instructionIndex === wrap.instructionIndex &&
      ix.innerInstructionIndex !== null,
  )!;
  child.programId = "unknown-execution";
  expect(parseTransaction(tx, DISCOVERED_PROGRAMS).review.join(" ")).toContain("unknown-execution");
});

it.each([
  [okxBuy, "BUY", "11274325", "74073996"],
  [okxSell, "SELL", "11274325", "40349767"],
] as const)(
  "uses verified OKX customer settlement across unfamiliar inner pools",
  (raw, side, pyth, counter) => {
    const tx = fixtureTransaction(raw);
    const result = parseTransaction(tx, DISCOVERED_PROGRAMS);
    expect(result.review).toEqual([]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      router: "OKX",
      side,
      pythAmountRaw: pyth,
      counterAmountRaw: counter,
      owner: null,
      flags: expect.arrayContaining(["TRANSFER_VERIFIED_SETTLEMENT"]),
    });
    const unfamiliar = structuredClone(tx);
    const pool = unfamiliar.instructions.find(
      (ix) => ix.instructionIndex === 7 && ix.stackHeight === 2 && ix.programId !== "proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u" && ix.programId !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    )!;
    pool.programId = "unfamiliar-pool-program";
    expect(parseTransaction(unfamiliar, DISCOVERED_PROGRAMS).trades).toHaveLength(1);
  },
);

it("holds OKX when the reported output disagrees with the customer transfer", () => {
  const tx = fixtureTransaction(okxBuy);
  const event = tx.instructions.find(
    (ix) => ix.instructionName === "SwapWithFeesCpiEventEnhanced2",
  )!;
  event.args.destination_token_change = "1";
  const result = parseTransaction(tx, DISCOVERED_PROGRAMS);
  expect(result.trades).toEqual([]);
  expect(result.review.join(" ")).toContain("Unverified router settlement");
});

it("holds OKX when an output fee transfer disagrees with the event", () => {
  const tx = fixtureTransaction(okxSell);
  const fee = tx.instructions.find(
    (ix) => ix.instructionIndex === 7 && ix.innerInstructionIndex === 19,
  )!;
  fee.args.amount = "1";
  const result = parseTransaction(tx, DISCOVERED_PROGRAMS);
  expect(result.trades).toEqual([]);
  expect(result.review.join(" ")).toContain("Unverified router settlement");
});

it("holds OKX when a second customer debit is hidden in the route", () => {
  const tx = fixtureTransaction(okxBuy);
  const input = tx.instructions.find(
    (ix) => ix.instructionIndex === 7 && ix.innerInstructionIndex === 0,
  )!;
  tx.instructions.splice(tx.instructions.indexOf(input) + 1, 0, {
    ...structuredClone(input),
    innerInstructionIndex: 0.5,
    args: { amount: "1", decimals: 6 },
  });
  const result = parseTransaction(tx, DISCOVERED_PROGRAMS);
  expect(result.trades).toEqual([]);
  expect(result.review.join(" ")).toContain("Unverified router settlement");
});
