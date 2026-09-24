import { expect, it } from "vitest";
import raw from "./fixtures/positions/intermediate-cycle-raw.json";
import { parseEvidence } from "../lib/tracker/parsers";
import { mergeConfirmedExchange } from "../lib/tracker/semantics/pool-exchange";
const signature = raw.transaction.signatures[0];
const parse = (r = structuredClone(raw)) =>
  parseEvidence(
    { signature, rawTransaction: r, parserStatus: "UNAVAILABLE" },
    signature,
    true,
    [],
  );
it("excludes a fully verified four-pool PYTH-intermediate cycle", () => {
  const r = parse();
  expect(r.trades).toEqual([]);
  expect(r.review).toEqual([]);
  expect(r.stateAnalysis!.exclusions).toEqual([
    expect.objectContaining({
      kind: "PYTH_INTERMEDIATE_CYCLE",
      settlementNetRaw: "6788",
      poolCalls: 4,
    }),
  ]);
  expect(
    r.stateAnalysis!.economic.domains.find((d) => d.kind === "SIGNER_CONTROL")
      ?.eventType,
  ).toBe("PYTH_INTERMEDIATE");
});
it("does not need to recognize the outer router", () => {
  const r = structuredClone(raw),
    i = r.transaction.message.instructions[2].programIdIndex;
  r.transaction.message.accountKeys[i] = "11111111111111111111111111111112";
  expect(parse(r).stateAnalysis!.exclusions).toHaveLength(1);
});
it("does not claim a full cycle when an unrelated pool is unverified", () => {
  const r = structuredClone(raw);
  r.meta.innerInstructions.find((g) => g.index === 2)!.instructions[0].data =
    "11111111";
  expect(
    parse(r).stateAnalysis!.exclusions.some(
      (e) => e.kind === "PYTH_INTERMEDIATE_CYCLE",
    ),
  ).toBe(false);
  expect(parse(r).stateAnalysis!.exclusions[0]?.kind).toBe(
    "PYTH_INTERMEDIATE_ROUTE",
  );
});
it("does not claim a full cycle with an extra unverified instruction", () => {
  const r = structuredClone(raw),
    g = r.meta.innerInstructions.find((g) => g.index === 2)!;
  g.instructions.push({
    ...g.instructions[0],
    programIdIndex: r.transaction.message.instructions[2].programIdIndex,
    data: "",
    accounts: [],
    stackHeight: 2,
  });
  expect(
    parse(r).stateAnalysis!.exclusions.some(
      (e) => e.kind === "PYTH_INTERMEDIATE_CYCLE",
    ),
  ).toBe(false);
});
it("rejects partial balance evidence and ambiguous CPI depth", () => {
  const r = structuredClone(raw);
  r.meta.postTokenBalances.pop();
  expect(parse(r).stateAnalysis!.exclusions).toEqual([]);
  const s = structuredClone(raw);
  s.meta.innerInstructions.find(
    (g) => g.index === 2,
  )!.instructions[0].stackHeight = null as unknown as number;
  expect(parse(s).stateAnalysis!.exclusions).toEqual([]);
});
it("clears only its own review reason", () => {
  const r = parse(),
    exclusions = r.stateAnalysis!.exclusions,
    e = exclusions[0];
  const reason = `Unsupported execution program ${e.programId} at ${e.instructionIndex}:top: decoded swap evidence requires economic boundary review`;
  expect(
    mergeConfirmedExchange(
      { trades: [], orders: [], review: [reason, "Different issue"] },
      [],
      exclusions,
    ).review,
  ).toEqual(["Different issue"]);
});
