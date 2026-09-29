import type { Connection } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { fetchBuybackTransactions } from "@/lib/growth/buybackTransactions";

describe("buyback transaction catch-up", () => {
  it("paces small batches and keeps every signature", async () => {
    const getParsedTransactions = vi.fn().mockImplementation(async (batch: string[]) => batch.map(() => null));
    const pause = vi.fn().mockResolvedValue(undefined);
    const signatures = Array.from({ length: 12 }, (_, i) => `signature-${i}`);
    const result = await fetchBuybackTransactions(
      { getParsedTransactions } as unknown as Pick<Connection, "getParsedTransactions">,
      signatures, pause,
    );
    expect(getParsedTransactions.mock.calls.map(([batch]) => batch)).toEqual([
      signatures.slice(0, 5), signatures.slice(5, 10), signatures.slice(10),
    ]);
    expect(pause.mock.calls).toEqual([[1_000], [1_000]]);
    expect(result).toHaveLength(signatures.length);
  });

  it("retries only the rate-limited batch", async () => {
    const getParsedTransactions = vi.fn()
      .mockResolvedValueOnce(Array(5).fill(null))
      .mockRejectedValueOnce(new Error("Too many requests for a specific RPC call"))
      .mockResolvedValueOnce(Array(2).fill(null));
    const pause = vi.fn().mockResolvedValue(undefined);
    const signatures = Array.from({ length: 7 }, (_, i) => `signature-${i}`);
    await fetchBuybackTransactions(
      { getParsedTransactions } as unknown as Pick<Connection, "getParsedTransactions">,
      signatures, pause,
    );
    expect(getParsedTransactions.mock.calls.map(([batch]) => batch)).toEqual([
      signatures.slice(0, 5), signatures.slice(5), signatures.slice(5),
    ]);
    expect(pause.mock.calls).toEqual([[1_000], [2_000]]);
  });

  it("does not retry non-rate-limit failures", async () => {
    const getParsedTransactions = vi.fn().mockRejectedValue(new Error("invalid transaction request"));
    const pause = vi.fn().mockResolvedValue(undefined);
    await expect(fetchBuybackTransactions(
      { getParsedTransactions } as unknown as Pick<Connection, "getParsedTransactions">,
      ["signature"], pause,
    )).rejects.toThrow("invalid transaction request");
    expect(getParsedTransactions).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });
});
