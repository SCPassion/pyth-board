import { expect, it } from "vitest";
import corpus from "./fixtures/positions/review-corpus.json";
import { parseEvidence } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import {
  instructionBytes,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
} from "../lib/tracker/normalize";
import { PYTH_MINT } from "../lib/tracker/config";
import { mergeConfirmedExchange } from "../lib/tracker/semantics/pool-exchange";
const get = (prefix: string) =>
  structuredClone(corpus.find((p) => p.signature.startsWith(prefix))!);
const parse = (p: (typeof corpus)[number], success = true) =>
  parseEvidence(p, p.signature, success, DISCOVERED_PROGRAMS);
function encode(bytes: number[]) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = bytes.reduce((n, b) => (n << 8n) + BigInt(b), 0n),
    out = "";
  while (n) {
    out = alphabet[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b) break;
    out = "1" + out;
  }
  return out;
}
const keys = (p: (typeof corpus)[number]) => [
  ...p.rawTransaction.transaction.message.accountKeys,
  ...p.rawTransaction.meta.loadedAddresses.writable,
  ...p.rawTransaction.meta.loadedAddresses.readonly,
];
it.each(corpus.map((p) => [p.signature, p] as const))(
  "resolves retained review %s",
  (_signature, p) => {
    const r = parse(p);
    expect(r.review).toEqual([]);
    const count = p.signature.startsWith("kgDe")
      ? 2
      : ["5hL7", "MxZa"].some((s) => p.signature.startsWith(s))
        ? 1
        : 0;
    expect(r.trades).toHaveLength(count);
    if (!count) expect(r.stateAnalysis!.exclusions).toHaveLength(1);
  },
);
it("uses net Token-2022 credit, retaining the gross pool leg separately", () => {
  const r = parse(get("MxZa")),
    t = r.trades[0];
  expect(t).toMatchObject({
    side: "SELL",
    pythAmountRaw: "1571472525",
    outputAmountRaw: "30072244764886",
    counterAmountRaw: "30072244764886",
  });
  expect(t.routeLegs[0].outputAmountRaw).toBe("30376004813017");
  expect(
    r.stateAnalysis!.normalized.transfers.find(
      (t) => t.tokenProgram === TOKEN_2022_PROGRAM,
    ),
  ).toMatchObject({ observedFeeRaw: "303760048131" });
});
it("preserves independent executions without duplication or hiding unrelated reviews", () => {
  const r = parse(get("kgDe"));
  expect(r.trades.map((t) => t.side)).toEqual(["BUY", "SELL"]);
  expect(r.trades[1].pythAmountRaw).toBe("877435794");
  expect(
    mergeConfirmedExchange(r, r.stateAnalysis!.confirmedTrades).trades,
  ).toHaveLength(2);
  const withIssue = { ...r, review: ["Another unresolved execution"] };
  expect(
    mergeConfirmedExchange(withIssue, r.stateAnalysis!.confirmedTrades).review,
  ).toEqual(withIssue.review);
  const raw = get("kgDe");
  raw.parserStatus = "UNAVAILABLE";
  delete raw.parsed;
  expect(parse(raw).review).toContain("Provider could not decode transaction");
});
it("does not use net-zero PYTH without both verified pool calls", () => {
  const p = get("58Tvt"),
    g = p.rawTransaction.meta.innerInstructions.find((g) => g.index === 1)!;
  g.instructions[0].data = "11111111";
  expect(parse(p).stateAnalysis!.exclusions).toEqual([]);
});
it("keeps unrelated non-PYTH legs outside the PYTH-only conclusion", () => {
  const p = get("nrrq"),
    r = parse(p);
  expect(r.stateAnalysis!.exclusions[0]).toMatchObject({
    kind: "PYTH_INTERMEDIATE_ROUTE",
    poolCalls: 2,
  });
  expect(r.stateAnalysis!.exclusions[0].settlementNetRaw).toBeUndefined();
});
it("rejects transfer hooks instead of inferring their effects from net balances", () => {
  const p = get("58Tvt"),
    k = keys(p),
    g = p.rawTransaction.meta.innerInstructions.find((g) => g.index === 1)!;
  const at = g.instructions.findIndex(
    (i) => k[i.programIdIndex] === TOKEN_2022_PROGRAM,
  );
  g.instructions.splice(at + 1, 0, { ...g.instructions[0], stackHeight: 4 });
  expect(parse(p).stateAnalysis!.normalized.issues).toContain(
    "Token-2022 transfer credit unresolved",
  );
  expect(parse(p).stateAnalysis!.exclusions).toEqual([]);
});
it("rejects impossible Token-2022 credits", () => {
  const p = get("5hL7"),
    s = p.rawTransaction.meta.postTokenBalances.find(
      (s) => s.programId === TOKEN_2022_PROGRAM,
    )!;
  s.uiTokenAmount.amount = "99999999999999999";
  expect(parse(p).trades).toEqual([]);
});
it("requires raw creation evidence before assuming missing balances are zero", () => {
  const p = get("49Tas"),
    k = keys(p);
  for (const g of p.rawTransaction.meta.innerInstructions)
    for (const ix of g.instructions)
      if (
        k[ix.programIdIndex] === TOKEN_2022_PROGRAM &&
        instructionBytes(ix.data)[0] === 18
      )
        ix.data = "1";
  expect(parse(p).stateAnalysis!.exclusions).toEqual([]);
});
it("requires a matching temporary-account close authority", () => {
  const p = get("58Tvt"),
    k = keys(p);
  for (const g of p.rawTransaction.meta.innerInstructions)
    for (const ix of g.instructions)
      if (
        k[ix.programIdIndex] === TOKEN_PROGRAM &&
        instructionBytes(ix.data)[0] === 9
      )
        ix.accounts[2] = ix.accounts[0];
  expect(parse(p).stateAnalysis!.exclusions).toEqual([]);
});
it("rejects additional PYTH movements even when their net change is zero", () => {
  const p = get("58Tvt"),
    k = keys(p),
    g = p.rawTransaction.meta.innerInstructions.find((g) => g.index === 1)!;
  const transfer = g.instructions.find(
    (i) =>
      k[i.programIdIndex] === TOKEN_PROGRAM &&
      i.accounts.some((a) => k[a] === PYTH_MINT),
  )!;
  const extra = structuredClone(transfer);
  extra.accounts[2] = extra.accounts[0];
  g.instructions.push(extra);
  expect(parse(p).stateAnalysis!.exclusions).toEqual([]);
});
it("rejects an altered genesis mint amount", () => {
  const p = get("MxZa"),
    k = keys(p);
  for (const g of p.rawTransaction.meta.innerInstructions)
    for (const ix of g.instructions) {
      if (k[ix.programIdIndex] !== TOKEN_2022_PROGRAM) continue;
      const b = instructionBytes(ix.data);
      if (b[0] === 7) {
        b[1] ^= 1;
        ix.data = encode(b);
      }
    }
  expect(parse(p).trades).toEqual([]);
});
it("does not allow an existing mint to masquerade as transaction-local genesis", () => {
  const p = get("MxZa"),
    k = keys(p);
  const ix = p.rawTransaction.meta.innerInstructions
    .flatMap((g) => g.instructions)
    .find(
      (i) =>
        k[i.programIdIndex] === TOKEN_2022_PROGRAM &&
        instructionBytes(i.data)[0] === 20,
    )!;
  p.rawTransaction.meta.preBalances[ix.accounts[0]] = 1;
  expect(parse(p).trades).toEqual([]);
});
it("does not ignore funded fee-account authority changes", () => {
  const p = get("MxZa"),
    k = keys(p);
  const ix = p.rawTransaction.meta.innerInstructions
    .flatMap((g) => g.instructions)
    .find(
      (i) =>
        k[i.programIdIndex] === TOKEN_PROGRAM &&
        instructionBytes(i.data)[0] === 6,
    )!;
  p.rawTransaction.meta.postTokenBalances.find(
    (b) => b.accountIndex === ix.accounts[0],
  )!.uiTokenAmount.amount = "1";
  expect(parse(p).trades).toEqual([]);
});
it("never certifies failed execution", () => {
  for (const p of corpus) {
    const r = parse(p, false);
    expect(r.trades).toEqual([]);
    expect(r.stateAnalysis!.exclusions).toEqual([]);
  }
});
