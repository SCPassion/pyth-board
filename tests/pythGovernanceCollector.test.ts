import { describe, expect, it, vi } from "vitest";
import { collectGovernanceStakers } from "../lib/growth/governanceCollector";
import { entry } from "./governanceFixtures";
const endpoint = "https://mainnet.helius-rpc.com/?api-key=test";
const response = (result: unknown) => new Response(JSON.stringify({ result }));
const clock = (seconds = 6048000n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(seconds); return response({ value: { data: [b.toString("base64"), "base64"] } }); };
const page = (accounts = [entry()], paginationKey: string | null = null) => response({ accounts, paginationKey });
const run = (fetcher: typeof fetch, now?: () => number) => collectGovernanceStakers(endpoint, { fetcher, now });
describe("Helius governance collector", () => {
  it("deduplicates across all pages and follows short/empty pages", async () => {
    const f = vi.fn().mockResolvedValueOnce(clock()).mockResolvedValueOnce(page([entry()], "a"))
      .mockResolvedValueOnce(page([], "b")).mockResolvedValueOnce(page([entry(), entry(2), entry(3, [{ ois: true }])])).mockResolvedValueOnce(clock());
    const result = await run(f);
    expect(result).toMatchObject({ stakers: 2, totalStakeAccounts: 4, eligibleStakeAccounts: 3, pages: 3, requests: 5 });
    expect(f.mock.calls.every(([url]) => url === endpoint)).toBe(true);
    const req = JSON.parse(f.mock.calls[1][1].body);
    expect(req.params[1]).toMatchObject({ filters: [{ memcmp: { offset: 0, bytes: "FM2r3wAdZaa" } }] });
    expect(req.params[1].dataSlice).toBeUndefined();
    expect(f.mock.calls[0][1].redirect).toBe("error");
  });
  it.each([undefined, "https://api.mainnet-beta.solana.com", "https://mainnet.helius-rpc.com.evil.test", "http://mainnet.helius-rpc.com"])("rejects non-Helius configuration %s", async url => {
    const f = vi.fn(); await expect(collectGovernanceStakers(url, { fetcher: f })).rejects.toThrow(); expect(f).not.toHaveBeenCalled();
  });
  it.each([
    () => new Response("bad"), () => new Response("no", { status: 429 }),
    () => new Response(JSON.stringify({ error: { message: "secret" } })),
    () => response({ accounts: [] }), () => page([entry()], "loop"),
  ])("rejects failed pages and repeated cursors", async bad => {
    const f = vi.fn().mockResolvedValueOnce(clock()).mockImplementation(async () => bad());
    await expect(run(f)).rejects.toThrow();
  });
  it("rejects zero counts", async () => {
    await expect(run(vi.fn().mockResolvedValueOnce(clock()).mockResolvedValueOnce(page([])).mockResolvedValueOnce(clock()))).rejects.toThrow("zero");
  });
  it("sanitizes network/timeout failures without fallback", async () => {
    const f = vi.fn().mockRejectedValue(Error("secret endpoint"));
    await expect(run(f)).rejects.toThrow("network failure or timeout"); expect(f).toHaveBeenCalledTimes(1);
  });
  it("rejects epoch and chain-day boundaries", async () => {
    for (const end of [6652800n, 6134400n]) {
      await expect(run(vi.fn().mockResolvedValueOnce(clock()).mockResolvedValueOnce(page()).mockResolvedValueOnce(clock(end)))).rejects.toThrow("crossed");
    }
  });
  it("rejects local midnight and the overall deadline", async () => {
    const start = Date.UTC(2026, 8, 12, 23, 59, 59);
    const f = vi.fn().mockResolvedValueOnce(clock()).mockResolvedValueOnce(page()).mockResolvedValueOnce(clock());
    await expect(run(f, () => f.mock.calls.length === 3 ? start + 2000 : start)).rejects.toThrow("midnight");
    await expect(run(vi.fn(), vi.fn().mockReturnValueOnce(start).mockReturnValue(start + 480001))).rejects.toThrow("deadline");
  });
});
