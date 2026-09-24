import { expect, it } from "vitest";
import dflowBuy from "./fixtures/routers/dflow-token-buy.json";
import dflowIntermediate from "./fixtures/routers/dflow-intermediate-pyth.json";
import recurringBuy from "./fixtures/routers/jupiter-recurring-usdc-buy.json";
import recurringMixedPoolsBuy from "./fixtures/routers/jupiter-recurring-mixed-pools-buy.json";
import { decodeHelius } from "../lib/tracker/helius-format";
import { completeEvidence, parseTransaction } from "../lib/tracker/parsers";
import { analyzeRawEvidence } from "../lib/tracker/state-analysis";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { genericRouters } from "../lib/tracker/routers/execution";
import { applyRouterScope } from "../lib/tracker/routers/scope";
import { fixtureTransaction } from "./tracker-fixture";

const parse = (payload: unknown) =>
  parseTransaction(fixtureTransaction(payload), DISCOVERED_PROGRAMS);

it("decodes a DFlow PYTH endpoint buy but holds it outside the initial scope", () => {
  const result = parse(dflowBuy);
  expect(result.trades).toEqual([]);
  expect(result.review).toHaveLength(1);
  expect(result.review[0]).toContain("DFLOW: held outside initial router scope");
  expect(genericRouters(decodeHelius(dflowBuy)).trades[0]).toMatchObject({
    router: "DFLOW",
    product: "SWAP",
    side: "BUY",
    pythAmountRaw: "151685477",
    counterAmountRaw: "1003421805",
  });
});

it("excludes a DFlow route that only uses PYTH between endpoint tokens", () => {
  const result = parse(dflowIntermediate);
  expect(result.review).toEqual([]);
  expect(result.trades).toEqual([]);
});

it("holds raw-state DFlow evidence without excluding Jupiter's inner pool", () => {
  const trade = genericRouters(decodeHelius(dflowBuy)).trades[0];
  const rawState = { ...trade, router: "STATE_EXCHANGE" };
  const analysis = analyzeRawEvidence(dflowBuy, dflowBuy.signature, true);
  const held = completeEvidence(
    { trades: [], orders: [], review: [] },
    { ...analysis, confirmedTrades: [rawState] },
  );
  expect(held.trades).toEqual([]);
  expect(held.review.join(" ")).toContain("DFLOW: held outside initial router scope");

  const jupiter = parse(recurringMixedPoolsBuy).trades[0];
  expect(applyRouterScope({ trades: [jupiter], orders: [], review: [] }).trades)
    .toHaveLength(1);
});

it("attributes a current Jupiter recurring PYTH buy to the fill", () => {
  const result = parse(recurringBuy);
  expect(result.review).toEqual([]);
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0]).toMatchObject({
    router: "JUPITER",
    product: "RECURRING",
    side: "BUY",
    // The route's gross PYTH output includes a 7.726083 PYTH DCA fee.
    pythAmountRaw: "7718356963",
    counterAmountRaw: "500663405",
  });
});

it("records a Jupiter recurring PYTH buy through unlisted inner pools", () => {
  const result = parse(recurringMixedPoolsBuy);
  expect(result.review).toEqual([]);
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0]).toMatchObject({
    router: "JUPITER",
    product: "RECURRING",
    side: "BUY",
    pythAmountRaw: "7910184334",
    counterAmountRaw: "500663405",
  });
});
