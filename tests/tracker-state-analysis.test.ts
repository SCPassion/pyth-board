import { analyzeNativeSol } from "../lib/tracker/native-sol";
import { WSOL_MINT } from "../lib/tracker/normalize";
import {
  createInitializeAccount3Instruction,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import { expect, it } from "vitest";
import {
  normalizeTransaction,
  TOKEN_PROGRAM,
  TOKEN_2022_PROGRAM,
} from "../lib/tracker/normalize";
import { analyzeEconomicDomains } from "../lib/tracker/economic-domains";
import { PYTH_MINT } from "../lib/tracker/config";
import { PublicKey } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const user = pk(1),
  pool = pk(2),
  pyth = new PublicKey(PYTH_MINT),
  counter = pk(3),
  router = pk(4);
// Independent SDK encoder builds wire-format fixtures for the raw decoder.
function encode(data: Uint8Array) {
  const abc = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt("0x" + Buffer.from(data).toString("hex"));
  let out = "";
  while (n) {
    out = abc[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of data) {
    if (b) break;
    out = "1" + out;
  }
  return out;
}
function sample() {
  const keys = [
    user,
    pool,
    pk(5),
    pk(6),
    pk(7),
    pk(8),
    pyth,
    counter,
    new PublicKey(TOKEN_PROGRAM),
    router,
  ].map((k) => k.toBase58());
  const instructions = [
    createTransferCheckedInstruction(pk(5), counter, pk(6), user, 100n, 6),
    createTransferCheckedInstruction(pk(7), pyth, pk(8), pool, 200n, 6),
  ].map((ix) => ({
    programIdIndex: 8,
    accounts: ix.keys.map((k) => keys.indexOf(k.pubkey.toBase58())),
    data: encode(ix.data),
    stackHeight: 2,
  }));
  const balance = (
    index: number,
    mint: PublicKey,
    owner: PublicKey,
    amount: string,
  ) => ({
    accountIndex: index,
    mint: mint.toBase58(),
    owner: owner.toBase58(),
    programId: TOKEN_PROGRAM,
    uiTokenAmount: { decimals: 6, amount },
  });
  return {
    slot: 1,
    blockTime: 100,
    transaction: {
      signatures: ["test-signature"],
      message: {
        header: { numRequiredSignatures: 1 },
        accountKeys: keys,
        instructions: [
          {
            programIdIndex: 9,
            accounts: [0, 1, 2, 3, 4, 5],
            data: "",
            stackHeight: 1,
          },
        ],
      },
    },
    meta: {
      err: null,
      fee: 5,
      preBalances: keys.map((_, i): number => (i ? 10 : 100)),
      postBalances: keys.map((_, i): number => (i ? 10 : 95)),
      loadedAddresses: { writable: [], readonly: [] },
      innerInstructions: [{ index: 0, instructions }],
      preTokenBalances: [
        balance(2, counter, user, "100"),
        balance(3, counter, pool, "1000"),
        balance(4, pyth, pool, "1000"),
        balance(5, pyth, user, "0"),
      ],
      postTokenBalances: [
        balance(2, counter, user, "0"),
        balance(3, counter, pool, "1100"),
        balance(4, pyth, pool, "800"),
        balance(5, pyth, user, "200"),
      ],
    },
  };
}
it("observes all asset deltas and a connected exchange through an unseen router", () => {
  const raw = sample(),
    n = normalizeTransaction(raw, "test-signature", true),
    r = analyzeEconomicDomains(n);
  expect(n.status).toBe("RECONCILED");
  expect(n.tokenStates).toHaveLength(4);
  expect(n.transfers).toHaveLength(2);
  const d = r.domains.find((d) => d.kind === "SIGNER_CONTROL")!;
  expect(d.swapCandidate).toMatchObject({
    side: "BUY",
    pythAmountRaw: "200",
    counterAmountRaw: "100",
  });
  expect(d.evidence.connectedExecution).toBe(true);
  // The same wire evidence could be a receipt redemption. No false economic certainty.
  expect(d.eventType).toBe("UNKNOWN");
  expect(d.evidence.liquidityOperationExcluded).toBe(false);
  expect(n.native.balances[0]).toMatchObject({
    deltaRaw: "-5",
    feeAdjustedDeltaRaw: "0",
  });
});
it("does not turn independent atomic transfers into a connected swap", () => {
  const raw = sample();
  raw.transaction.message.instructions.push(
    raw.transaction.message.instructions[0],
  );
  const second = raw.meta.innerInstructions[0].instructions.pop()!;
  raw.meta.innerInstructions.push({ index: 1, instructions: [second] });
  const r = analyzeEconomicDomains(
    normalizeTransaction(raw, "test-signature", true),
  );
  expect(r.domains.every((d) => d.swapCandidate === null)).toBe(true);
});
it("does not merge non-signer vaults based on their common token authority", () => {
  const raw = sample();
  for (const side of [raw.meta.preTokenBalances, raw.meta.postTokenBalances])
    for (const b of side)
      if (b.owner === user.toBase58()) b.owner = router.toBase58();
  const r = analyzeEconomicDomains(
    normalizeTransaction(raw, "test-signature", true),
  );
  expect(
    r.domains.every(
      (d) =>
        d.kind === "UNRESOLVED_ACCOUNT" &&
        d.accounts.length === 1 &&
        d.swapCandidate === null,
    ),
  ).toBe(true);
});
it("retains mint/burn evidence and blocks swap candidates even when opposing deltas exist", () => {
  const raw = sample(),
    ix = createMintToInstruction(pyth, pk(8), pool, 200n);
  raw.meta.innerInstructions[0].instructions[1] = {
    programIdIndex: 8,
    accounts: ix.keys.map((k) =>
      raw.transaction.message.accountKeys.indexOf(k.pubkey.toBase58()),
    ),
    data: encode(ix.data),
    stackHeight: 2,
  };
  const n = normalizeTransaction(raw, "test-signature", true);
  expect(n.instructions.some((i) => i.tokenEffect === "MINT")).toBe(true);
  expect(
    analyzeEconomicDomains(n).domains.every((d) => d.swapCandidate === null),
  ).toBe(true);
});
it("uses loaded addresses exactly once and does not guess missing address tables", () => {
  const raw = sample();
  const moved = raw.transaction.message.accountKeys.splice(6);
  raw.meta.loadedAddresses.readonly = moved as never[];
  expect(normalizeTransaction(raw, "test-signature", true).status).toBe(
    "RECONCILED",
  );
  raw.meta.loadedAddresses.readonly = [];
  expect(normalizeTransaction(raw, "test-signature", true).status).toBe(
    "UNAVAILABLE",
  );
});
it("reconciles isolated Token-2022 checked transfers without inferring an extension configuration", () => {
  const raw = sample();
  for (const side of [raw.meta.preTokenBalances, raw.meta.postTokenBalances])
    for (const b of side) b.programId = TOKEN_2022_PROGRAM;
  raw.transaction.message.accountKeys[8] = TOKEN_2022_PROGRAM;
  const n = normalizeTransaction(raw, "test-signature", true);
  expect(n.tokenStates).toHaveLength(4);
  expect(n.status).toBe("RECONCILED");
  expect(n.transfers.every((t) => t.observedFeeRaw === "0")).toBe(true);
  expect(analyzeEconomicDomains(n).domains.some((d) => !!d.swapCandidate)).toBe(
    true,
  );
});
it("does not lose token evidence when native numbers cannot be represented safely", () => {
  const raw = sample();
  raw.meta.preBalances[0] = Number.MAX_SAFE_INTEGER + 1;
  const n = normalizeTransaction(raw, "test-signature", true);
  expect(n.status).toBe("RECONCILED");
  expect(n.native.balances).toEqual([]);
  expect(n.native.issues.length).toBeGreaterThan(0);
});
it("ignores provider annotations entirely and rejects failed execution", () => {
  const raw = sample();
  expect(
    normalizeTransaction(
      { ...raw, parsed: { fake: "BUY" } },
      "test-signature",
      true,
    ),
  ).toEqual(normalizeTransaction(raw, "test-signature", true));
  expect(normalizeTransaction(raw, "test-signature", false).status).toBe(
    "UNAVAILABLE",
  );
});
it("classifies direct PYTH token movement without claiming a vault deposit or trade", () => {
  const raw = sample();
  raw.transaction.message.instructions =
    raw.meta.innerInstructions[0].instructions
      .slice(1)
      .map((i) => ({ ...i, stackHeight: 1 }));
  raw.meta.innerInstructions = [];
  raw.meta.postTokenBalances[0].uiTokenAmount.amount = "100";
  raw.meta.postTokenBalances[1].uiTokenAmount.amount = "1000";
  const r = analyzeEconomicDomains(
    normalizeTransaction(raw, "test-signature", true),
  );
  expect(r.domains.find((d) => d.kind === "SIGNER_CONTROL")?.eventType).toBe(
    "TRANSFER",
  );
  expect(r.domains.every((d) => !d.swapCandidate)).toBe(true);
});

it("observes v1 RPC JSON without binary SDK deserialization or instruction-based fee guesses", () => {
  const raw = sample();
  const n = normalizeTransaction(
    {
      ...raw,
      version: 1,
      transaction: {
        ...raw.transaction,
        message: {
          ...raw.transaction.message,
          transactionConfig: { priorityFee: 2 },
        },
      },
    },
    "test-signature",
    true,
  );
  expect(n.transactionVersion).toBe(1);
  expect(n.status).toBe("RECONCILED");
  expect(n.native.feeRaw).toBe("5");
  expect(
    normalizeTransaction({ ...raw, version: 2 }, "test-signature", true).status,
  ).toBe("UNAVAILABLE");
});

function temporaryWsol() {
  const raw = sample(),
    wsol = new PublicKey(WSOL_MINT);
  raw.transaction.message.accountKeys[7] = WSOL_MINT;
  for (const side of [raw.meta.preTokenBalances, raw.meta.postTokenBalances])
    for (const b of side)
      if (b.mint === counter.toBase58()) {
        b.mint = WSOL_MINT;
        b.uiTokenAmount.decimals = 9;
      }
  raw.meta.preTokenBalances = raw.meta.preTokenBalances.filter(
    (b) => b.accountIndex !== 2,
  );
  raw.meta.postTokenBalances = raw.meta.postTokenBalances.filter(
    (b) => b.accountIndex !== 2,
  );
  const wire = (ix: ReturnType<typeof createCloseAccountInstruction>) => ({
    programIdIndex: 8,
    accounts: ix.keys.map((k) =>
      raw.transaction.message.accountKeys.indexOf(k.pubkey.toBase58()),
    ),
    data: encode(ix.data),
    stackHeight: 1,
  });
  raw.meta.innerInstructions[0].instructions[0].data = encode(
    createTransferCheckedInstruction(pk(5), wsol, pk(6), user, 100n, 9).data,
  );
  raw.transaction.message.instructions.unshift(
    wire(createInitializeAccount3Instruction(pk(5), wsol, user)),
  );
  raw.transaction.message.instructions.push(
    wire(createCloseAccountInstruction(pk(5), user, user)),
  );
  raw.meta.innerInstructions[0].index = 1;
  raw.meta.preBalances[0] = 1000;
  raw.meta.postBalances[0] = 895;
  raw.meta.preBalances[2] = 0;
  raw.meta.postBalances[2] = 0;
  raw.meta.postBalances[3] = 110;
  return raw;
}
it("reconciles temporary WSOL without treating rent or refunded SOL as a second asset", () => {
  const n = normalizeTransaction(temporaryWsol(), "test-signature", true);
  expect(n.status).toBe("PARTIAL"); // Raw token endpoint balances remain honestly absent.
  expect(analyzeNativeSol(n).domains).toEqual([
    expect.objectContaining({
      controller: user.toBase58(),
      nativeNetRaw: "-100",
      wsolBoundaryNetRaw: "-100",
      status: "RECONCILED",
    }),
  ]);
});
it("treats a wrap/unwrap round trip as zero exchange", () => {
  const raw = temporaryWsol();
  raw.meta.innerInstructions[0].instructions.shift();
  raw.meta.postBalances[0] = 995;
  raw.meta.postBalances[3] = 10;
  raw.meta.postTokenBalances.find(
    (b) => b.accountIndex === 3,
  )!.uiTokenAmount.amount = "1000";
  const n = normalizeTransaction(raw, "test-signature", true);
  expect(analyzeNativeSol(n).domains[0]).toMatchObject({
    nativeNetRaw: "0",
    wsolBoundaryNetRaw: "0",
    status: "RECONCILED",
  });
});
it("does not absorb a tip into the SOL swap amount", () => {
  const raw = temporaryWsol();
  raw.meta.postBalances[0] = 893;
  raw.meta.postBalances[9] = 12;
  expect(
    analyzeNativeSol(normalizeTransaction(raw, "test-signature", true))
      .domains[0],
  ).toMatchObject({
    nativeNetRaw: "-102",
    wsolBoundaryNetRaw: "-100",
    status: "UNRESOLVED",
  });
});
it("refuses temporary WSOL ownership when the close recipient differs", () => {
  const raw = temporaryWsol();
  raw.transaction.message.instructions.at(-1)!.accounts[1] = 1;
  expect(
    analyzeNativeSol(normalizeTransaction(raw, "test-signature", true))
      .domains[0].status,
  ).toBe("UNRESOLVED");
});
it("blocks receipt-like issuance from swap classification and explains the domain evidence", () => {
  const raw = sample(),
    ix = createMintToInstruction(pyth, pk(8), pool, 200n);
  raw.meta.innerInstructions[0].instructions[1] = {
    programIdIndex: 8,
    accounts: ix.keys.map((k) =>
      raw.transaction.message.accountKeys.indexOf(k.pubkey.toBase58()),
    ),
    data: encode(ix.data),
    stackHeight: 2,
  };
  const d = analyzeEconomicDomains(
    normalizeTransaction(raw, "test-signature", true),
  ).domains.find((d) => d.kind === "SIGNER_CONTROL")!;
  expect(d.evidence.supplyChangeTouchesDomain).toBe(true);
  expect(d.eventType).toBe("UNKNOWN");
  expect(d.swapCandidate).toBeNull();
  expect(d.reasons[0]).toContain("receipt-token");
});

it("does not call a PYTH deposit with receipt-token issuance a sale", () => {
  const raw = sample();
  const receipt = createMintToInstruction(counter, pk(5), pool, 100n);
  const deposit = createTransferCheckedInstruction(
    pk(8),
    pyth,
    pk(7),
    user,
    200n,
    6,
  );
  raw.meta.innerInstructions[0].instructions = [receipt, deposit].map((ix) => ({
    programIdIndex: 8,
    accounts: ix.keys.map((k) =>
      raw.transaction.message.accountKeys.indexOf(k.pubkey.toBase58()),
    ),
    data: encode(ix.data),
    stackHeight: 2,
  }));
  raw.meta.postTokenBalances[0].uiTokenAmount.amount = "200";
  raw.meta.postTokenBalances[1].uiTokenAmount.amount = "1000";
  raw.meta.postTokenBalances[2].uiTokenAmount.amount = "1200";
  raw.meta.preTokenBalances[3].uiTokenAmount.amount = "200";
  raw.meta.postTokenBalances[3].uiTokenAmount.amount = "0";
  const d = analyzeEconomicDomains(
    normalizeTransaction(raw, "test-signature", true),
  ).domains.find((d) => d.kind === "SIGNER_CONTROL")!;
  expect(d.evidence.counterAssetNetChange).toBe(true);
  expect(d.evidence.supplyChangeTouchesDomain).toBe(true);
  expect(d.swapCandidate).toBeNull();
  expect(d.eventType).toBe("UNKNOWN");
});
it("keeps a program-mediated vault claim distinct from a buy", () => {
  const raw = sample();
  raw.meta.innerInstructions[0].instructions.shift();
  raw.meta.postTokenBalances[0].uiTokenAmount.amount = "100";
  raw.meta.postTokenBalances[1].uiTokenAmount.amount = "1000";
  const d = analyzeEconomicDomains(
    normalizeTransaction(raw, "test-signature", true),
  ).domains.find((d) => d.kind === "SIGNER_CONTROL")!;
  expect(d.swapCandidate).toBeNull();
  expect(d.eventType).toBe("UNKNOWN");
  expect(d.evidence.counterAssetNetChange).toBe(false);
});
