import { analyzeEconomicDomains } from "../lib/tracker/economic-domains";
import { expect, it } from "vitest";
import raw from "./fixtures/positions/recurring-raw.json";
import { normalizeTransaction } from "../lib/tracker/normalize";
import { analyzeDcaPositions, DCA_PROGRAM } from "../lib/tracker/semantics/dca";
const signature = raw.transaction.signatures[0];
const analyze = (r = structuredClone(raw)) =>
  analyzeDcaPositions(r, normalizeTransaction(r, signature, true));
it("links a real flash-fill position and keeps its following withdrawal separate", () => {
  const [execution, claim] = analyze();
  expect(execution).toMatchObject({
    kind: "EXECUTION",
    status: "VERIFIED",
    owner: null,
    startInstructionIndex: 2,
    instructionIndex: 4,
  });
  expect(execution.movements.map((m) => m.amountRaw)).toEqual([
    "1000000000",
    "2176866328",
  ]);
  expect(claim).toMatchObject({
    kind: "WITHDRAWAL",
    status: "VERIFIED",
    position: execution.position,
    owner: "GAdn7TZhszf5KTfwNRx3A2nP6KCRFEWucZubgdEqbJA2",
  });
  expect(claim.movements[0].amountRaw).toBe("2174689462");
});
it("does not infer a position from enhanced provider labels", () => {
  const r = structuredClone(raw);
  r.transaction.message.instructions[2].data = "11111111";
  expect(analyze(r)[0].status).toBe("UNRESOLVED");
});
it("rejects vault ownership changes even under the known program", () => {
  const r = structuredClone(raw);
  r.meta.preTokenBalances.find((b) => b.accountIndex === 5)!.owner =
    DCA_PROGRAM;
  expect(analyze(r).every((o) => o.status === "UNRESOLVED")).toBe(true);
});
it("does not use same-mint receipts outside the flash-fill boundary", () => {
  const r = structuredClone(raw);
  const group = r.meta.innerInstructions.find((g) => g.index === 3)!;
  group.instructions = group.instructions.filter(
    (i) => !i.accounts.includes(5),
  );
  expect(analyze(r)[0].status).toBe("UNRESOLVED");
});
it("does not call a withdrawal verified without its raw vault transfer", () => {
  const r = structuredClone(raw);
  r.meta.innerInstructions = r.meta.innerInstructions.filter(
    (g) => g.index !== 5,
  );
  expect(analyze(r)[1].status).toBe("UNRESOLVED");
});
it("does not resolve unsuccessful transactions", () => {
  expect(
    analyzeDcaPositions(raw, normalizeTransaction(raw, signature, false)),
  ).toEqual([]);
});

it("groups only the verified execution vaults as a protocol position", () => {
  const n = normalizeTransaction(raw, signature, true);
  const positions = analyzeDcaPositions(raw, n);
  const domain = analyzeEconomicDomains(n, positions).domains.find(
    (d) => d.kind === "PROTOCOL_POSITION",
  )!;
  expect(domain.accounts.sort()).toEqual([...positions[0].vaults].sort());
  expect(domain.controller).toBeNull();
  expect(
    analyzeEconomicDomains(
      n,
      positions.map((p) => ({ ...p, status: "UNRESOLVED" as const })),
    ).domains.some((d) => d.kind === "PROTOCOL_POSITION"),
  ).toBe(false);
});
