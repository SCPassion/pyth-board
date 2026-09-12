import { describe, expect, it } from "vitest";
import { countPythHolders } from "@/lib/growth/holders";

function account(owner: number, amount: bigint) {
  const data = Buffer.alloc(40);
  data.fill(owner, 0, 32);
  data.writeBigUInt64LE(amount, 32);
  return { account: { data: [data.toString("base64"), "base64"] } };
}

describe("native PYTH holder counting", () => {
  it.each([
    [[account(1, 100n)], 1],
    [[account(1, 100n), account(2, 200n)], 2],
    [[account(1, 100n), account(1, 50n)], 1],
    [[account(1, 100n), account(2, 0n)], 1],
    [[account(1, 0n)], 0],
    [[account(1, 2n ** 64n - 1n), account(2, 2n ** 53n + 1n)], 2],
  ])("counts positive unique owners", (accounts, expected) => {
    expect(countPythHolders(accounts).holders).toBe(expected);
  });

  it("reports diagnostics", () => {
    expect(countPythHolders([account(1, 1n), account(1, 2n), account(2, 0n)]))
      .toEqual({ holders: 1, totalTokenAccounts: 3, positiveTokenAccounts: 2 });
  });

  it.each([undefined, {}, [null], [{ account: { data: ["!", "base64"] } }],
    [{ account: { data: [Buffer.alloc(39).toString("base64"), "base64"] } }],
    [{ account: { data: [Buffer.alloc(41).toString("base64"), "base64"] } }],
    [{ account: { data: [Buffer.alloc(40).toString("base64"), "base58"] } }],
  ].map(value => [value]))("rejects malformed responses", (value) => {
    expect(() => countPythHolders(value)).toThrow();
  });
});
