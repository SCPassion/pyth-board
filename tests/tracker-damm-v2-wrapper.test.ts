import { expect, it } from "vitest";
import wrapper from "./fixtures/positions/review-jupiter-wrapper-raw.json";
import bot from "./fixtures/positions/review-arbitrage-wrapper-raw.json";
import { parseEvidence } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { ROUTER } from "../lib/tracker/config";

function parse(raw: { transaction: { signatures: string[] } }) {
  const signature = raw.transaction.signatures[0];
  return parseEvidence(
    { signature, rawTransaction: raw, parserStatus: "UNAVAILABLE" },
    signature,
    true,
    DISCOVERED_PROGRAMS,
  );
}

it("recovers the delegated-owner DAMM v2 sell inside an unknown Jupiter wrapper", () => {
  const result = parse(structuredClone(wrapper));
  expect(result.review).toEqual([]);
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0]).toMatchObject({
    side: "SELL",
    product: "SWAP",
    owner: "8cyrHTbeooeD3ZHPpxzz1yYnPtsdnHqjKKTEXTAQSfFf",
    pythAmountRaw: "1214666789",
    counterAmountRaw: "76445408",
    routeLegs: [expect.objectContaining({ dexName: "Meteora DAMM v2" })],
  });
});

it("requires the Jupiter parent and the same owner on both token endpoints", () => {
  const noJupiter = structuredClone(wrapper);
  const jupiterIndex = noJupiter.transaction.message.accountKeys.indexOf(ROUTER);
  noJupiter.meta.innerInstructions[0].instructions[0].programIdIndex = 0;
  expect(jupiterIndex).toBeGreaterThan(-1);
  expect(parse(noJupiter).trades).toEqual([]);

  const wrongOwner = structuredClone(wrapper);
  const output = wrongOwner.meta.postTokenBalances.find(
    (balance) =>
      balance.mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" &&
      balance.owner === "8cyrHTbeooeD3ZHPpxzz1yYnPtsdnHqjKKTEXTAQSfFf",
  );
  expect(output).toBeDefined();
  const input = wrongOwner.meta.preTokenBalances.find(
    (balance) => balance.accountIndex === output!.accountIndex,
  );
  expect(input).toBeDefined();
  output!.owner = "11111111111111111111111111111111";
  input!.owner = "11111111111111111111111111111111";
  expect(parse(wrongOwner).trades).toEqual([]);
});

it("does not turn the unknown arbitrage wrapper into a user trade", () => {
  const result = parse(structuredClone(bot));
  expect(result.trades).toEqual([]);
  expect(result.stateAnalysis!.confirmedTrades).toEqual([]);
  expect(result.stateAnalysis!.exclusions).toEqual([
    expect.objectContaining({ kind: "PYTH_INTERMEDIATE_ROUTE", poolCalls: 2 }),
  ]);
  expect(result.review).toEqual([]);
});
