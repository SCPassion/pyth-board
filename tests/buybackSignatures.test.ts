import type { Connection, PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { fetchNewBuybackSignatures } from "@/lib/growth/buybackSignatures";

const owner = {} as PublicKey;

function connectionFor(signatures: string[]) {
  const getSignaturesForAddress = vi.fn(async (_owner: PublicKey, options: { before?: string; until?: string; limit?: number }) => {
    const start = options.before ? signatures.indexOf(options.before) + 1 : 0;
    const untilIndex = options.until ? signatures.indexOf(options.until) : -1;
    const end = untilIndex < 0 ? signatures.length : untilIndex;
    if (start === 0 && options.before) throw new Error("Unknown page cursor");
    return signatures.slice(start, end).slice(0, options.limit).map(signature => ({ signature }));
  });
  return { getSignaturesForAddress } as unknown as Pick<Connection, "getSignaturesForAddress">;
}

describe("buyback signature catch-up", () => {
  it("processes a backlog above 300 oldest first without skipping any signature", async () => {
    const signatures = Array.from({ length: 650 }, (_, index) => `s${649 - index}`);
    const connection = connectionFor(signatures);
    const processed: string[] = [];
    let cursor = "s-1";

    for (const expectedSize of [300, 300, 50]) {
      const batch = await fetchNewBuybackSignatures(connection, owner, cursor);
      expect(batch).toHaveLength(expectedSize);
      processed.push(...batch);
      cursor = batch[0];
    }

    expect(processed).toHaveLength(650);
    expect(new Set(processed).size).toBe(650);
    expect(processed.slice().sort()).toEqual(signatures.slice().sort());
    expect(await fetchNewBuybackSignatures(connection, owner, cursor)).toEqual([]);
  });

  it("includes new arrivals while continuing an older backlog", async () => {
    const signatures = Array.from({ length: 350 }, (_, index) => `s${349 - index}`);
    const connection = connectionFor(signatures);
    const first = await fetchNewBuybackSignatures(connection, owner, "s-1");
    expect(first[0]).toBe("s299");
    signatures.unshift("s351", "s350");
    const second = await fetchNewBuybackSignatures(connection, owner, first[0]);
    expect(second).toEqual(["s351", "s350", ...Array.from({ length: 50 }, (_, index) => `s${349 - index}`)]);
  });

  it("fails safely if the backlog exceeds the scan limit", async () => {
    const atLimit = Array.from({ length: 10_000 }, (_, index) => `s${9_999 - index}`);
    expect(await fetchNewBuybackSignatures(connectionFor(atLimit), owner, "s-1")).toHaveLength(300);
    const signatures = Array.from({ length: 10_001 }, (_, index) => `s${10_000 - index}`);
    const connection = connectionFor(signatures);
    await expect(fetchNewBuybackSignatures(connection, owner, "s-1")).rejects.toThrow("safe scan limit");
  });
});
