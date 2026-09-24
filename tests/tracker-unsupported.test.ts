import { expect, it } from "vitest";
import evidence from "./fixtures/routers/unsupported-wrapper-evidence.json";
import titan from "./fixtures/routers/titan-buy.json";
import { decodeHelius } from "../lib/tracker/helius-format";
import { parseTransaction } from "../lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "../lib/tracker/registry";
import { fixtureTransaction } from "./tracker-fixture";

const parse = (tx: ReturnType<typeof decodeHelius>) =>
  parseTransaction(tx, DISCOVERED_PROGRAMS);

it.each(evidence)("retains real unsupported wrapper cycle $signature for review", (raw) => {
  const tx = decodeHelius(raw);
  const result = parse(tx);
  expect(result.trades).toEqual([]);
  expect(result.orders).toEqual([]);
  expect(result.review).toHaveLength(1);
  expect(result.review[0]).toMatch(/Unsupported execution program .* at \d+:top/);
});

it("does not promote a supported child router; preserves an independent sibling", () => {
  const tx = fixtureTransaction(titan);
  const root = tx.instructions.find((ix) => ix.programId.startsWith("T1TAN"))!;
  const branch = tx.instructions.filter((ix) => ix.instructionIndex === root.instructionIndex);
  const wrapper = {
    ...root, programId: "unknown-wrapper", programName: undefined,
    summary: null, accounts: {}, instructionName: null,
  };
  tx.instructions = [wrapper, ...branch.map((ix, i) => ({
    ...ix, innerInstructionIndex: i, stackHeight: (ix.stackHeight ?? 1) + 1,
  })), ...branch.map((ix) => ({ ...ix, instructionIndex: root.instructionIndex + 1 }))];
  const before = JSON.stringify(tx);
  const result = parse(tx);
  expect(result.review).toHaveLength(1);
  expect(result.trades).toHaveLength(1);
  expect(result.trades[0].tradeId).toContain(`:${root.instructionIndex + 1}:top`);
  expect(JSON.stringify(tx)).toBe(before);
});

it("ignores failed executions and unknown instructions without swap evidence", () => {
  const tx = decodeHelius(evidence[0]);
  tx.success = false;
  expect(parse(tx)).toEqual({ trades: [], orders: [], review: [] });
  tx.success = true;
  tx.instructions = tx.instructions.map((ix) => ({ ...ix, summary: null }));
  expect(parse(tx)).toEqual({ trades: [], orders: [], review: [] });
});
