import { describe, it, expect } from "vitest";
import sell from "./fixtures/routers/okx-sell.json";
import split from "./fixtures/routers/okx-split-sell.json";
import intermediate from "./fixtures/routers/jupiter-intermediate-pyth.json";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { fixtureTransaction } from "./tracker-fixture";
const parse = (raw: unknown) => parseTransaction(fixtureTransaction(raw), DISCOVERED_PROGRAMS);
describe("Birdeye mainnet comparison", () => {
  it.each([
    [sell, "368531029", "46482174484742"],
    [split, "301026387", "37978690368473"],
  ])("preserves the OKX economic sell, including fees and all route hops", (raw, pyth, output) => {
    const result = parse(raw);
    expect(result.review).toEqual([]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      router: "OKX", side: "SELL", pythAmountRaw: pyth,
      counterAmountRaw: output,
      counterMint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      owner: null, ownerConfidence: "UNRESOLVED",
    });
    expect(result.trades[0].routeLegs).toHaveLength(5);
  });
  it("excludes Jupiter HNT to SOL with intermediate PYTH despite two Birdeye rows", () => {
    const result = parse(intermediate);
    expect(result.trades).toEqual([]);
    expect(result.review).toEqual([]);
  });
});
