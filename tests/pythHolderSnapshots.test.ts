import { expect, it } from "vitest";
import { store } from "@/convex/pythHolders";

it("keeps the first canonical snapshot and rejects invalid counts", async () => {
 const rows: Record<string, unknown>[] = [];
 const db = {
  query: () => ({ withIndex: () => ({ unique: async () => rows[0] ?? null }) }),
  insert: async (_table: string, row: Record<string,unknown>) => { rows.push({_id:"one",...row}); return "one"; },
 };
 // Exercise the real mutation handler with a minimal transactional DB double.
 const handler = (store as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
 const args = {holders:2,collectedAt:Date.UTC(2026,8,10,3),totalTokenAccounts:4,positiveTokenAccounts:3};
 await handler({db},args); await handler({db},{...args,holders:3});
 expect(rows).toHaveLength(1); expect(rows[0].holders).toBe(2); expect(rows[0].date).toBe("2026-09-10");
 await expect(handler({db},{...args,holders:0})).rejects.toThrow();
 await expect(handler({db},{...args,holders:NaN})).rejects.toThrow();
 expect(rows[0].holders).toBe(2);
});
