import { describe, it, expect } from "vitest";
import titanFixture from "./fixtures/routers/titan-buy.json";
import dflowFixture from "./fixtures/routers/dflow-wrap-buy.json";
import jupiterFixture from "./fixtures/jupiter/normal-buy.json";
import { decodeHelius } from "../lib/tracker/helius-format";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { fixtureTransaction } from "./tracker-fixture";
import { ROUTER_ADAPTERS } from "../lib/tracker/routers/registry";
import { genericRouters } from "../lib/tracker/routers/execution";
import { PYTH_MINT, ROUTER } from "../lib/tracker/config";
import type { Instruction, Transaction } from "../lib/tracker/types";
const SOL = "So11111111111111111111111111111111111111112";
const root = (id = "TITAN"): Instruction => {
  const a = ROUTER_ADAPTERS.find((a) => a.id === id)!;
  return {
    instructionIndex: 0,
    innerInstructionIndex: null,
    stackHeight: 1,
    programId: a.programIds[0] ?? "provider-mapped-program",
    programName: a.providerNames[0],
    instructionName: "swap",
    accounts: { user: "owner" },
    args: {},
    summary: null,
  };
};
const leg = (
  i: number,
  input = SOL,
  output = PYTH_MINT,
  amount = "100",
  received = "200",
): Instruction => ({
  instructionIndex: 0,
  innerInstructionIndex: i,
  stackHeight: 2,
  programId: "dex",
  instructionName: "swap",
  accounts: {},
  args: {},
  summary: {
    type: "swap",
    parsedData: {
      input_mint: input,
      output_mint: output,
      in_amount: amount,
      actual_out_amount: received,
    },
  },
});
const tx = (instructions: Instruction[]): Transaction => ({
  signature: "test",
  slot: 1,
  blockTime: 1000,
  success: true,
  instructions,
  decimals: { [SOL]: 9, [PYTH_MINT]: 6 },
});
const parse = (t: Transaction) => parseTransaction(t, DISCOVERED_PROGRAMS);
describe("shared router executions", () => {
  it.each([
    ["Jupiter", jupiterFixture, "JUPITER"],
  ] as const)("%s keeps the outer trade through an unfamiliar inner pool", (_, raw, router) => {
    const transaction = decodeHelius(raw);
    const pool = transaction.instructions.find(
      (ix) =>
        ix.innerInstructionIndex !== null &&
        ix.summary?.type === "swap" &&
        ix.programId !== ROUTER,
    )!;
    pool.programId = "unfamiliar-inner-pool";
    const result = parse(transaction);
    expect(result.review).toEqual([]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].router).toBe(router);
  });
  it("combines the actual Titan split buy into one economic trade", () => {
    const result = parse(fixtureTransaction(titanFixture));
    expect(result.review).toEqual([]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      router: "TITAN",
      side: "BUY",
      pythAmountRaw: "910946604",
      counterAmountRaw: "495625000",
      owner: null,
    });
    expect(result.trades[0].routeLegs).toHaveLength(2);
  });
  it("keeps DFlow decoding available for review without publishing the trade", () => {
    const transaction = decodeHelius(dflowFixture);
    const pool = transaction.instructions.find(
      (ix) => ix.innerInstructionIndex !== null && ix.summary?.type === "swap",
    )!;
    pool.programId = "unfamiliar-inner-pool";
    expect(genericRouters(transaction).trades[0].router).toBe("DFLOW");
    const result = parse(transaction);
    expect(result.trades).toEqual([]);
    expect(result.review.join(" ")).toContain("DFLOW: held outside initial router scope");
  });
  for (const router of ["TITAN", "OKX"]) {
    it(`${router}: shared buy/sell parsing without ingestion changes`, () => {
      expect(parse(tx([root(router), leg(0), leg(1)])).trades[0]).toMatchObject(
        { router, side: "BUY", pythAmountRaw: "400" },
      );
      expect(
        parse(tx([root(router), leg(0, PYTH_MINT, SOL)])).trades[0],
      ).toMatchObject({ router, side: "SELL", pythAmountRaw: "100" });
    });
  }
  it("holds both synthetic DFlow endpoint directions from publication", () => {
    for (const instructions of [
      [root("DFLOW"), leg(0), leg(1)],
      [root("DFLOW"), leg(0, PYTH_MINT, SOL)],
    ]) {
      const result = parse(tx(instructions));
      expect(result.trades).toEqual([]);
      expect(result.review.join(" ")).toContain("DFLOW: held outside initial router scope");
    }
  });
  it("collapses multihop raw amounts exactly", () => {
    const result = parse(
      tx([
        root(),
        leg(0, SOL, "middle", "100", "12345678901234567890"),
        leg(1, "middle", PYTH_MINT, "12345678901234567890", "300"),
      ]),
    );
    expect(result.trades[0].pythAmountRaw).toBe("300");
  });
  it("reviews unmatched intermediate amounts rather than inventing a trade", () => {
    const result = parse(
      tx([root(), leg(0, SOL, "middle"), leg(1, "middle", PYTH_MINT)]),
    );
    expect(result.trades).toHaveLength(0);
    expect(result.review.length).toBeGreaterThan(0);
  });
  it("does not count PYTH intermediate hops", () => {
    expect(
      parse(tx([root(), leg(0), leg(1, PYTH_MINT, "other", "200", "300")]))
        .trades,
    ).toHaveLength(0);
  });
  it("does not count child Jupiter executions twice", () => {
    const jup = { ...leg(0), programId: ROUTER, instructionName: "route" };
    expect(parse(tx([root(), jup])).trades).toHaveLength(1);
    const outer = { ...root(), programId: ROUTER, summary: leg(0).summary };
    const nested = { ...root(), innerInstructionIndex: 0, stackHeight: 2 };
    const child = { ...leg(1), stackHeight: 3 };
    expect(parse(tx([outer, nested, child])).trades).toHaveLength(1);
  });
  it("preserves independent sibling router executions", () => {
    const r = { ...root(), instructionIndex: 1 };
    const l = { ...leg(0), instructionIndex: 1 };
    expect(parse(tx([root(), leg(0), r, l])).trades).toHaveLength(2);
  });
  it("excludes failed transactions and reviews empty executions", () => {
    expect(
      parse({ ...tx([root(), leg(0)]), success: false }).trades,
    ).toHaveLength(0);
    expect(parse(tx([root()])).review.length).toBe(1);
  });
  it("does not publish partial totals when another execution branch is undecoded", () => {
    const unknown = { ...leg(1), programId: "unknown-dex", summary: null };
    const result = parse(tx([root(), leg(0), unknown]));
    expect(result.trades).toHaveLength(0);
    expect(result.review.join(" ")).toContain("Undecoded execution branch");
  });
  it("a fifth adapter uses the same engine", () => {
    const extra = {
      id: "NEW",
      label: "New",
      programIds: ["new-program"],
      providerNames: [],
      ownerRoles: [],
    };
    const r = { ...root(), programId: "new-program", programName: undefined };
    expect(
      genericRouters(tx([r, leg(0)]), [...ROUTER_ADAPTERS, extra]).trades[0]
        .router,
    ).toBe("NEW");
  });
  it("unknown routers do not gain support from a similar display name", () => {
    expect(
      parse(
        tx([
          { ...root(), programId: "unknown", programName: "titan_swap_fake" },
          leg(0),
        ]),
      ).trades,
    ).toHaveLength(0);
  });
});
