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
  expect(JSON.parse(fetcher.mock.calls[1][1].body).params[1].paginationKey).toBe("next");
 });
 it("continues empty pages that have a cursor", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(page([], "next")).mockResolvedValueOnce(page([account(1)],null));
  expect((await collectPythHolders("https://example.test",fetcher)).holders).toBe(1);
 });
 it.each([
  new Response("bad json"), new Response("no",{status:403}),
  new Response(JSON.stringify({error:{code:-1,message:"secret"}})),
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
 it("sanitizes network errors",async()=> {
  await expect(collectPythHolders("https://example.test",vi.fn().mockRejectedValue(Error("secret")))).rejects.toThrow("network");
 });
});
