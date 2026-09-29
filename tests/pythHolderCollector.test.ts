import { describe, expect, it, vi } from "vitest";
import { collectPythHolders } from "@/lib/growth/collector";
function account(owner: number) {
 const data = Buffer.alloc(40); data.fill(owner, 0, 32); data.writeBigUInt64LE(1n,32);
 return { account: { data: [data.toString("base64"), "base64"] } };
}
const page = (accounts: unknown[], paginationKey: string | null) => new Response(JSON.stringify({result:{accounts,paginationKey}}));
describe("paginated holder collector", () => {
 it("deduplicates across pages and continues short pages", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(page([account(1)], "next")).mockResolvedValueOnce(page([account(1),account(2)], null));
  const result = await collectPythHolders("https://example.test", fetcher);
  expect(result.holders).toBe(2); expect(result.pages).toBe(2);
  expect(result.topHolders.map(row => row.amount)).toEqual(["2", "1"]);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).params[1].paginationKey).toBe("next");
 });
 it("stores only the largest 100 with deterministic ties", async () => {
  const accounts = Array.from({length:110},(_,i)=>account(i+1));
  const fetcher = vi.fn().mockResolvedValue(page(accounts,null));
  const result = await collectPythHolders("https://example.test",fetcher);
  expect(result.holders).toBe(110);
  expect(result.topHolders).toHaveLength(100);
  expect(result.topHolders.map(row=>row.owner)).toEqual(result.topHolders.map(row=>row.owner).sort());
 });
 it("continues empty pages that have a cursor", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(page([], "next")).mockResolvedValueOnce(page([account(1)],null));
  expect((await collectPythHolders("https://example.test",fetcher)).holders).toBe(1);
 });
 it.each([
  new Response("bad json"), new Response("no",{status:403}),
  new Response(JSON.stringify({error:{code:-32602,message:"secret"}})),
  new Response(JSON.stringify({result:{accounts:[]}})), page([],null),
 ])("rejects failed or incomplete collections", async (response) => {
  await expect(collectPythHolders("https://example.test",vi.fn().mockResolvedValue(response))).rejects.toThrow();
 });
 it("rejects repeated cursors",async()=> {
  await expect(collectPythHolders("https://example.test",vi.fn().mockImplementation(()=>page([account(1)],"loop")))).rejects.toThrow("cursor");
 });
 it("rejects missing configuration",async()=> {
  await expect(collectPythHolders(undefined)).rejects.toThrow("PRIMARY_SOLANA_RPC_URL");
 });
 it("retries a transient JSON-RPC error on the same cursor",async()=> {
  vi.useFakeTimers();
  try {
   const fetcher = vi.fn().mockResolvedValueOnce(page([account(1)],"next"))
    .mockResolvedValueOnce(new Response(JSON.stringify({error:{code:-32000,message:"provider details"}})))
    .mockResolvedValueOnce(page([account(2)],null));
   const pending = collectPythHolders("https://example.test",fetcher);
   await vi.runAllTimersAsync();
   expect((await pending).holders).toBe(2);
   expect(fetcher).toHaveBeenCalledTimes(3);
   expect(JSON.parse(fetcher.mock.calls[1][1].body).params[1].paginationKey).toBe("next");
   expect(JSON.parse(fetcher.mock.calls[2][1].body).params[1].paginationKey).toBe("next");
  } finally { vi.useRealTimers(); }
 });
 it("retries HTTP 429 and respects retry-after",async()=> {
  vi.useFakeTimers();
  try {
   const fetcher=vi.fn().mockResolvedValueOnce(new Response("limited",{status:429,headers:{"retry-after":"2"}}))
    .mockResolvedValueOnce(page([account(1)],null));
   const pending=collectPythHolders("https://example.test",fetcher);
   await vi.advanceTimersByTimeAsync(1_999);
   expect(fetcher).toHaveBeenCalledTimes(1);
   await vi.advanceTimersByTimeAsync(1);
   expect((await pending).holders).toBe(1);
  } finally { vi.useRealTimers(); }
 });
 it("surfaces only the provider error code after bounded retries",async()=> {
  vi.useFakeTimers();
  try {
   const fetcher=vi.fn().mockImplementation(()=>new Response(JSON.stringify({error:{code:-32000,message:"secret provider details"}})));
   const pending=collectPythHolders("https://example.test",fetcher);
   const result=expect(pending).rejects.toThrow("PYTH RPC JSON-RPC error (code -32000)");
   await vi.runAllTimersAsync();
   await result;
   expect(fetcher).toHaveBeenCalledTimes(4);
  } finally { vi.useRealTimers(); }
 });
 it("sanitizes network errors",async()=> {
  vi.useFakeTimers();
  try {
   const pending=collectPythHolders("https://example.test",vi.fn().mockRejectedValue(Error("secret")));
   const result=expect(pending).rejects.toThrow("network");
   await vi.runAllTimersAsync();
   await result;
  } finally { vi.useRealTimers(); }
 });
});
