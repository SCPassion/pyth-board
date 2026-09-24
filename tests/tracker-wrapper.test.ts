import { it, expect } from "vitest";
import fixtures from "./fixtures/routers/whirlpool-wrapper.json";
import { decodeHelius } from "../lib/tracker/helius-format";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
it("indexes all eleven verified wrapped Whirlpool executions exactly once", () => {
  let buys = 0,
    sells = 0;
  for (const raw of fixtures) {
    const tx = decodeHelius(raw);
    const pool = tx.instructions.find((ix) => ix.summary?.type === "swap")!;
    const summary = pool.summary!.parsedData as Record<string, string>;
    const r = parseTransaction(tx, DISCOVERED_PROGRAMS);
    expect(r.review).toEqual([]);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]).toMatchObject({
      router: "WHIRLPOOL_WRAPPER",
      inputAmountRaw: summary.in_amount,
      outputAmountRaw: summary.actual_out_amount,
      owner: null,
      ownerConfidence: "UNRESOLVED",
    });
    expect(r.trades[0].routeLegs).toHaveLength(1);
    if (r.trades[0].side === "BUY") buys++;
    else sells++;
  }
  expect({ buys, sells }).toEqual({ buys: 4, sells: 7 });
});
it("does not emit a partial trade when the wrapper adds an undecoded branch", () => {
  const tx = decodeHelius(fixtures[0]);
  const root = tx.instructions.find(
    (ix) => ix.programId === "BoobsBSMpFRBA91sNwKLYShRRQPH5GjoCH4NhLUt4yRo",
  )!;
  tx.instructions.push({
    ...root,
    innerInstructionIndex: 99,
    stackHeight: 2,
    programId: "unknown-branch",
  });
  const r = parseTransaction(tx, DISCOVERED_PROGRAMS);
  expect(r.trades).toEqual([]);
  expect(r.review).toHaveLength(1);
});
