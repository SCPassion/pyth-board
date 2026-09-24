import { it, expect } from "vitest";
import buy from "./fixtures/routers/whirlpool-buy.json";
import v2 from "./fixtures/routers/whirlpool-v2-buy.json";
import titan from "./fixtures/routers/titan-buy.json";
import { decodeHelius } from "../lib/tracker/helius-format";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { fixtureTransaction } from "./tracker-fixture";
const parse = (tx: ReturnType<typeof decodeHelius>) =>
  parseTransaction(tx, DISCOVERED_PROGRAMS);
it.each([
  [buy, "5605943835", "3012413089"],
  [v2, "1251420611", "672257197"],
])("parses real direct Whirlpool buys", (raw, pyth, sol) => {
  const result = parse(decodeHelius(raw));
  expect(result.review).toEqual([]);
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0]).toMatchObject({
    router: "ORCA_WHIRLPOOL",
    side: "BUY",
    pythAmountRaw: pyth,
    counterAmountRaw: sol,
    ownerConfidence: "MEDIUM",
  });
  expect(result.trades[0].routeLegs).toHaveLength(1);
});
it("handles sells using executed amounts, not requested thresholds", () => {
  const tx = decodeHelius(buy);
  const ix = tx.instructions.find((i) => i.summary?.type === "swap")!;
  const d = ix.summary!.parsedData as Record<string, unknown>;
  [d.input_mint, d.output_mint] = [d.output_mint, d.input_mint];
  [d.in_amount, d.actual_out_amount] = [d.actual_out_amount, d.in_amount];
  expect(parse(tx).trades[0]).toMatchObject({
    side: "SELL",
    pythAmountRaw: "5605943835",
    counterAmountRaw: "3012413089",
  });
});
it("does not count Whirlpool CPI under Titan a second time", () => {
  const result = parse(fixtureTransaction(titan));
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0].router).toBe("TITAN");
});
it("does not promote pool legs under an unknown wrapper", () => {
  const tx = decodeHelius(buy);
  tx.instructions.forEach((ix) => {
    if (ix.summary?.type === "swap") {
      ix.innerInstructionIndex = 0;
      ix.stackHeight = 2;
    }
  });
  expect(parse(tx).trades).toEqual([]);
});
it("excludes failed transactions and liquidity lifecycle instructions", () => {
  const tx = decodeHelius(buy);
  tx.success = false;
  expect(parse(tx).trades).toEqual([]);
  tx.success = true;
  const ix = tx.instructions.find((i) => i.summary?.type === "swap")!;
  ix.instructionName = "increase_liquidity";
  ix.summary = null;
  expect(parse(tx).trades).toEqual([]);
});
it("retains malformed execution for review and never substitutes the payer for owner", () => {
  const tx = decodeHelius(buy);
  const ix = tx.instructions.find((i) => i.summary?.type === "swap")!;
  ix.accounts = {};
  expect(parse(tx).trades[0].owner).toBeNull();
  ix.summary = null;
  expect(parse(tx).review).toHaveLength(1);
});

it("keeps a real Jupiter through Whirlpool sell as one Jupiter execution", async () => {
  const raw = (await import("./fixtures/jupiter/normal-sell.json")).default;
  const tx = decodeHelius(raw);
  expect(
    tx.instructions.some(
      (ix) =>
        ix.programId === "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc" &&
        ix.innerInstructionIndex !== null,
    ),
  ).toBe(true);
  const result = parse(tx);
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0]).toMatchObject({ router: "JUPITER", side: "SELL" });
});
