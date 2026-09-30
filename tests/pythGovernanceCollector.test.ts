import { describe, expect, it, vi } from "vitest";
import { collectGovernanceStakers } from "../lib/growth/governanceCollector";
import { entry } from "./governanceFixtures";
import { PublicKey } from "@solana/web3.js";
const endpoint = "https://mainnet.helius-rpc.com/?api-key=test";
const response = (result: unknown) => new Response(JSON.stringify({ result }));
const clock = (seconds = 6048000n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(seconds); return response({ value: { data: [b.toString("base64"), "base64"] } }); };
const page = (accounts = [entry()], paginationKey: string | null = null) => response({ accounts, paginationKey });
const run = (fetcher: typeof fetch, now?: () => number) => collectGovernanceStakers(endpoint, { fetcher, now });
describe("Helius governance collector", () => {
  it("keeps different cooldown schedules separate and merges matching schedules across accounts", async () => {
    const f = vi.fn().mockResolvedValueOnce(clock())
      .mockResolvedValueOnce(page([entry(1, [{ amount: 7n, unlocking: 10n }, { amount: 11n, unlocking: 11n }])], "next"))
      .mockResolvedValueOnce(page([entry(1, [{ amount: 3n, unlocking: 10n }, { amount: 99n, unlocking: 9n }])]))
      .mockResolvedValueOnce(clock());
    const result = await run(f);
    expect(result.topUnstaking[0]).toMatchObject({ amount: "21", cooldowns: [
      { amount: "10", startAt: 6048000000, endAt: 6652800000 },
      { amount: "11", startAt: 6652800000, endAt: 7257600000 },
    ] });
    expect(result.cooldownSchedule).toEqual([
      { amount: "10", owners: 1, endAt: 6652800000 },
      { amount: "11", owners: 1, endAt: 7257600000 },
    ]);
  });
  it("aggregates owners across pages and ranks exact balances, including unstaking-only owners", async () => {
    const address = (owner: number) => new PublicKey(Buffer.alloc(32, owner)).toBase58();
    const f = vi.fn().mockResolvedValueOnce(clock())
      .mockResolvedValueOnce(page([
        entry(1, [{ amount: 2n ** 53n }]), entry(2, [{ amount: 2n ** 53n + 1n }]),
        entry(3, [{ amount: 90n, unlocking: 10n }]),
      ], "next"))
      .mockResolvedValueOnce(page([
        entry(1, [{ amount: 2n }, { amount: 30n, unlocking: 11n }]),
        entry(3, [{ amount: 20n, unlocking: 10n }]),
        entry(4, [{ amount: 999n, unlocking: 9n }, { amount: 999n, ois: true }]),
      ])).mockResolvedValueOnce(clock());
    const result = await run(f);
    expect(result.topStakers).toEqual([
      { owner: address(1), amount: (2n ** 53n + 32n).toString() },
      { owner: address(2), amount: (2n ** 53n + 1n).toString() },
    ]);
    expect(result.topUnstaking).toEqual([
      { owner: address(3), amount: "110", cooldowns: [{ amount: "110", startAt: 10 * 604800000, endAt: 11 * 604800000 }] },
      { owner: address(1), amount: "30", cooldowns: [{ amount: "30", startAt: 11 * 604800000, endAt: 12 * 604800000 }] },
    ]);
    expect(result.cooldownSchedule).toEqual([
      { amount: "110", owners: 1, endAt: 11 * 604800000 },
      { amount: "30", owners: 1, endAt: 12 * 604800000 },
    ]);
  });
  it("caps both rankings at 100 owners without limiting the full cooldown schedule", async () => {
    const accounts = Array.from({ length: 102 }, (_, i) => entry(i + 1, [{ amount: 5n, unlocking: 11n }]));
    const collect = (entries: typeof accounts) => run(vi.fn().mockResolvedValueOnce(clock())
      .mockResolvedValueOnce(page(entries)).mockResolvedValueOnce(clock()));
    const a = await collect(accounts), b = await collect(accounts.toReversed());
    expect(a.topStakers).toHaveLength(100);
    expect(a.topUnstaking).toHaveLength(100);
    expect(a.topStakers).toEqual(b.topStakers);
    expect(a.topUnstaking).toEqual(b.topUnstaking);
    expect(a.cooldownSchedule).toEqual([{ amount: "510", owners: 102, endAt: 12 * 604800000 }]);
  });
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
