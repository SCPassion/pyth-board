import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { rawAmount } from "@/lib/tracker/helius-format";
import { parseTransaction } from "@/lib/tracker/parsers";
import { DISCOVERED_PROGRAMS } from "@/lib/tracker/registry";
import { PYTH_MINT, ROUTER } from "@/lib/tracker/config";
import {
  addTotals,
  emptyTotals,
  contribution,
  retryDelay,
} from "@/lib/tracker/analytics";
import { webhookSignatures, readBoundedBody } from "@/lib/tracker/webhook";
import { fixtureTransaction } from "./tracker-fixture";
import type { Transaction, Instruction } from "@/lib/tracker/types";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
function ix(index = 0): Instruction {
  return {
    instructionIndex: index,
    innerInstructionIndex: null,
    stackHeight: 1,
    programId: ROUTER,
    instructionName: "route",
    accounts: { user_transfer_authority: "owner" },
    args: {},
    summary: {
      type: "swap",
      parsedData: {
        input_mint: USDC,
        output_mint: PYTH_MINT,
        in_amount: "2000000000",
        actual_out_amount: "500000000000",
        inner_swaps: [],
      },
    },
  };
}
function tx(instructions = [ix()]): Transaction {
  return {
    signature: "a".repeat(88),
    slot: 1,
    blockTime: 1000,
    success: true,
    decimals: { [USDC]: 6, [PYTH_MINT]: 6 },
    instructions,
  };
}
const parse = (t: Transaction) => parseTransaction(t, DISCOVERED_PROGRAMS);
describe("economic execution invariants", () => {
  it("classifies economic input/output and preserves exact raw amounts", () => {
    const t = parse(tx()).trades[0];
    expect(t.side).toBe("BUY");
    expect(t.pythAmountRaw).toBe("500000000000");
    expect(t.owner).toBe("owner");
  });
  it("handles sell and split/multihop routes as one trade", () => {
    const i = ix();
    i.summary = {
      type: "swap",
      parsedData: {
        input_mint: PYTH_MINT,
        output_mint: USDC,
        in_amount: "500000000000",
        actual_out_amount: "2000000000",
        inner_swaps: [
          {
            input_mint: PYTH_MINT,
            output_mint: "SOL",
            input_amount: "500000000000",
            output_amount: "1000",
          },
          {
            input_mint: "SOL",
            output_mint: USDC,
            input_amount: "1000",
            output_amount: "2000000000",
          },
        ],
      },
    };
    expect(parse(tx([i])).trades).toMatchObject([
      { side: "SELL", counterMint: USDC, routeLegs: [{}, {}] },
    ]);
  });
  it("ignores failed transactions, same-asset cycles, transfers and order funding", () => {
    expect(parse({ ...tx(), success: false }).trades).toEqual([]);
    const i = ix();
    i.summary = {
      type: "swap",
      parsedData: { input_mint: PYTH_MINT, output_mint: PYTH_MINT },
    };
    expect(parse(tx([i])).trades).toEqual([]);
    expect(
      parse(
        tx([{ ...ix(), programId: "token", summary: { type: "transfer" } }]),
      ).trades,
    ).toEqual([]);
  });
  it("keeps multiple executions deterministic", () => {
    const t = tx([ix(0), ix(1)]);
    expect(parse(t).trades.map((t) => t.tradeId)).toEqual([
      `${t.signature}:0:top`,
      `${t.signature}:1:top`,
    ]);
    expect(parse(t)).toEqual(parse(t));
  });
  it("never treats an unknown wrapper authority as owner", () => {
    const i = { ...ix(), innerInstructionIndex: 1, stackHeight: 2 };
    expect(parse(tx([i])).trades[0]).toMatchObject({
      owner: null,
      product: "UNKNOWN_JUPITER",
    });
  });
  it("preserves uncertain execution evidence for review", () => {
    const i = ix();
    i.summary = {
      type: "swap",
      parsedData: {
        input_mint: USDC,
        output_mint: PYTH_MINT,
        in_amount: Number.MAX_SAFE_INTEGER + 10,
        actual_out_amount: "3",
      },
    };
    expect(parse(tx([i])).review).toHaveLength(1);
  });
  it("does not attribute automated CPI fills to keepers", () => {
    const p = {
      programId: "trigger",
      product: "TRIGGER" as const,
      instructionNames: ["fill"],
      ownerRole: "maker",
      orderRole: "order",
      verified: true,
    };
    const parent = {
      ...ix(),
      programId: "trigger",
      instructionName: "fill",
      summary: null,
      accounts: { maker: "economic-owner", order: "order-1" },
    };
    const child = {
      ...ix(),
      innerInstructionIndex: 0,
      stackHeight: 2,
      accounts: { user_transfer_authority: "keeper" },
    };
    expect(
      parseTransaction(tx([parent, child]), [...DISCOVERED_PROGRAMS, p])
        .trades[0],
    ).toMatchObject({
      owner: "economic-owner",
      product: "TRIGGER",
      ownerConfidence: "HIGH",
    });
  });
  it("keeps unvalued/unattributed trades in totals and corrects replay contributions", () => {
    const t = { ...parse(tx()).trades[0], owner: null };
    const c = contribution(t);
    expect(c.valuedCount).toBe(0);
    expect(c.unresolvedCount).toBe(1);
    expect(addTotals(addTotals(emptyTotals(), c), c, -1)).toEqual(
      emptyTotals(),
    );
  });
  it("rejects unsafe raw numbers and caps retry delay", () => {
    expect(() => rawAmount(9007199254740992)).toThrow();
    expect(rawAmount("9007199254740993")).toBe("9007199254740993");
    expect(retryDelay(8)).toBe(3600000);
  });
});
describe("real mainnet golden fixtures", () => {
  for (const filename of readdirSync("tests/fixtures/jupiter").filter((f) =>
    f.endsWith(".json"),
  )) {
    it(filename, () => {
      const payload = JSON.parse(
        readFileSync(`tests/fixtures/jupiter/${filename}`, "utf8"),
      );
      const transaction = fixtureTransaction(payload);
      const result = parse(transaction);
      if (filename.startsWith("recurring-buy")) {
        expect(result.review).toEqual([]);
        expect(result.trades).toHaveLength(1);
        expect(result.trades[0]).toMatchObject({
          product: "RECURRING",
          side: "BUY",
          owner: "GAdn7TZhszf5KTfwNRx3A2nP6KCRFEWucZubgdEqbJA2",
          ownerConfidence: "HIGH",
        });
        const event = transaction.instructions.find(
          (i) => i.instructionName === "Filled",
        );
        expect(result.trades[0].pythAmountRaw).toBe(
          event?.args.out_amount,
        );
      }
      if (filename.startsWith("trigger-buy")) {
        expect(result.review).toEqual([]);
        expect(result.trades).toHaveLength(1);
        expect(result.trades[0]).toMatchObject({
          product: "TRIGGER",
          side: "BUY",
          owner: "GAdn7TZhszf5KTfwNRx3A2nP6KCRFEWucZubgdEqbJA2",
        });
        const event = transaction.instructions.find(
          (i) => i.instructionName === "TradeEvent",
        );
        expect(result.trades[0].pythAmountRaw).toBe(
          event?.args.taking_amount,
        );
      }
      if (filename === "normal-buy.json") {
        expect(result.review).toEqual([]);
        expect(result.trades).toHaveLength(1);
        expect(result.trades[0].side).toBe("BUY");
      }
      if (filename === "normal-sell.json") {
        expect(result.trades).toHaveLength(1);
        expect(result.trades[0].side).toBe("SELL");
      }
      if (filename === "route-cycle.json" || filename === "trigger-cancel.json")
        expect(result.trades).toEqual([]);
    });
  }
});
describe("webhook boundary", () => {
  it("accepts raw/enhanced signatures and deduplicates", () => {
    const signature = "a".repeat(88);
    expect(
      webhookSignatures([
        { signature },
        { transaction: { signatures: [signature] } },
      ]),
    ).toEqual([signature]);
  });
  it("rejects malformed and oversized payloads", async () => {
    expect(() => webhookSignatures([{ signature: "invalid" }])).toThrow();
    expect(() => webhookSignatures(Array(101).fill({}))).toThrow();
    await expect(
      readBoundedBody(
        new Request("https://example.com", { method: "POST", body: "12345" }),
        4,
      ),
    ).rejects.toThrow("too large");
  });
});

describe("valuation quality", () => {
  it("keeps missing/stale prices unavailable and values only execution-time evidence", async () => {
    const { applyHistoricalValuation } =
      await import("@/lib/tracker/valuation");
    const t = parse(tx()).trades[0];
    const payload = {
      coins: {
        "coingecko:pyth-network": {
          price: 0.05,
          timestamp: 1,
          confidence: 0.99,
        },
      },
    };
    expect(applyHistoricalValuation([t], payload)[0].usdValue).toBe(25000);
    expect(applyHistoricalValuation([t], {})[0].usdValue).toBeNull();
    payload.coins["coingecko:pyth-network"].timestamp = 100000;
    expect(applyHistoricalValuation([t], payload)[0].usdValue).toBeNull();
  });
});
