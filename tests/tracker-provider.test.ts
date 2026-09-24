import { afterEach, describe, it, expect, vi } from "vitest";
import { HeliusClient, ProviderError } from "../convex/heliusClient";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Helius boundary", () => {
  it("treats provider throttling as retryable without leaking credentials", async () => {
    vi.stubEnv("HELIUS_API_KEY", "private-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 429 })),
    );
    await expect(new HeliusClient().parsed("signature")).rejects.toMatchObject({
      message: "Helius HTTP 429",
      transient: true,
    });
  });
  it("requires finalization and distinguishes failed execution from a missing transaction", async () => {
    vi.stubEnv("HELIUS_API_KEY", "private-key");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          result: { value: [{ confirmationStatus: "confirmed", err: null }] },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          result: {
            value: [
              {
                confirmationStatus: "finalized",
                err: { InstructionError: [] },
              },
            ],
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      new HeliusClient().finalized("signature"),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(await new HeliusClient().finalized("signature")).toBe(false);
  });
});
it("keeps authoritative raw RPC evidence when enhanced decoding fails", async () => {
  vi.stubEnv("HELIUS_API_KEY", "private-key");
  const raw = {
    transaction: { signatures: ["signature"] },
    meta: { err: null },
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ result: raw }))
    .mockResolvedValueOnce(new Response("", { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  expect(await new HeliusClient().evidence("signature")).toEqual({
    signature: "signature",
    rawTransaction: raw,
    parserStatus: "UNAVAILABLE",
  });
  expect(JSON.parse(fetch.mock.calls[0][1].body).params[1]).toMatchObject({
    encoding: "json",
    maxSupportedTransactionVersion: 1,
    commitment: "finalized",
  });
});
it("retries missing raw RPC evidence rather than substituting enhanced summaries", async () => {
  vi.stubEnv("HELIUS_API_KEY", "private-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ result: null })),
  );
  await expect(new HeliusClient().evidence("signature")).rejects.toMatchObject({
    transient: true,
  });
});

it.each([null, [], {}, { jsonrpc: "2.0", id: 1 }])(
  "retries malformed RPC envelopes: %j", async (envelope) => {
    vi.stubEnv("HELIUS_API_KEY", "private-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(envelope)));
    await expect(new HeliusClient().raw("signature")).rejects.toMatchObject({ transient: true });
  },
);
it("retries invalid JSON without retaining provider content", async () => {
  vi.stubEnv("HELIUS_API_KEY", "private-key");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("private-key truncated response")));
  await expect(new HeliusClient().raw("signature")).rejects.toMatchObject({
    message: "Helius returned invalid JSON", transient: true,
  });
});
it.each([null, {}, { value: [] }, { value: [{ confirmationStatus: "finalized" }] }])(
  "never treats malformed finalization as failed execution: %j", async (result) => {
    vi.stubEnv("HELIUS_API_KEY", "private-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ result })));
    await expect(new HeliusClient().finalized("signature")).rejects.toMatchObject({ transient: true });
  },
);
it.each([
  { transaction: { signatures: ["wrong-signature"] }, meta: { err: null } },
  { transaction: { signatures: ["signature"] }, meta: {} },
  { transaction: { signatures: ["signature"] }, meta: null },
])("rejects wrong or incomplete raw evidence before enhanced parsing: %j", async (raw) => {
  vi.stubEnv("HELIUS_API_KEY", "private-key");
  const fetch = vi.fn(async () => Response.json({ result: raw }));
  vi.stubGlobal("fetch", fetch);
  await expect(new HeliusClient().evidence("signature")).rejects.toMatchObject({
    message: "Invalid raw transaction identity or status", transient: true,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
