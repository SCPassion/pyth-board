import { array, rawAmount, record } from "./helius-format";

export const NORMALIZER_VERSION = 3;
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export type TokenState = {
  account: string;
  mint: string;
  tokenProgram: string;
  decimals: number;
  owner: string | null;
  preRaw: string | null;
  postRaw: string | null;
  deltaRaw: string | null;
  issues: string[];
};
export type RawInstruction = {
  instructionIndex: number;
  innerInstructionIndex: number | null;
  stackHeight: number | null;
  programId: string;
  accounts: string[];
  tokenOpcode?: number;
  initializedOwner?: string;
  harvestWithheld?: boolean;
  tokenAdministrative?: boolean;
  initializesMint?: boolean;
  supplyAmountRaw?: string;
  tokenEffect:
    | "TRANSFER"
    | "MINT"
    | "BURN"
    | "INITIALIZE"
    | "CLOSE"
    | "OTHER"
    | null;
};
export type AssetTransfer = {
  instructionIndex: number;
  innerInstructionIndex: number | null;
  source: string;
  destination: string;
  authority: string;
  mint: string | null;
  amountRaw: string;
  tokenProgram: string;
  receivedAmountRaw?: string;
  observedFeeRaw?: string;
};
export type NormalizedTransaction = {
  signature: string;
  slot: number;
  blockTime: number;
  normalizerVersion: number;
  transactionVersion: "legacy" | 0 | 1 | null;
  status: "RECONCILED" | "PARTIAL" | "UNAVAILABLE";
  issues: string[];
  signers: string[];
  tokenStates: TokenState[];
  transfers: AssetTransfer[];
  instructions: RawInstruction[];
  native: {
    feeRaw: string | null;
    balances: {
      account: string;
      preRaw: string;
      postRaw: string;
      deltaRaw: string;
      feeAdjustedDeltaRaw: string;
    }[];
    issues: string[];
  };
};
export function instructionBytes(data: unknown, maxLength = 256): number[] {
  if (typeof data !== "string" || data.length > maxLength)
    throw Error("Invalid token instruction data");
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const c of data) {
    const d = alphabet.indexOf(c);
    if (d < 0) throw Error("Invalid base58");
    n = n * 58n + BigInt(d);
  }
  const out: number[] = [];
  while (n) {
    out.unshift(Number(n & 255n));
    n >>= 8n;
  }
  for (const c of data) {
    if (c !== "1") break;
    out.unshift(0);
  }
  return out;
}
function publicKeyFromBytes(bytes: number[]): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = bytes.reduce((n, b) => (n << 8n) + BigInt(b), 0n),
    result = "";
  while (n) {
    result = alphabet[Number(n % 58n)] + result;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b) break;
    result = "1" + result;
  }
  return result;
}
const u64 = (value: unknown) => {
  const s = rawAmount(value);
  if (BigInt(s) > 18446744073709551615n) throw Error("Invalid u64");
  return s;
};
/** Accepts the standard getTransaction encoding=json result, without provider annotations.
 * Lifecycle zeros and isolated Token-2022 credits require raw execution evidence.
 * Other extension semantics remain unresolved; lamports are not swap consideration. */
export function normalizeTransaction(
  value: unknown,
  signature: string,
  finalizedSuccess: boolean,
): NormalizedTransaction {
  const r: NormalizedTransaction = {
    signature,
    slot: 0,
    blockTime: 0,
    normalizerVersion: NORMALIZER_VERSION,
    transactionVersion: null,
    status: "UNAVAILABLE",
    issues: [],
    signers: [],
    tokenStates: [],
    transfers: [],
    instructions: [],
    native: { feeRaw: null, balances: [], issues: [] },
  };
  try {
    const raw = record(value),
      tx = record(raw.transaction),
      msg = record(tx.message),
      meta = record(raw.meta);
    if (!Object.keys(raw).length)
      throw Error("Raw transaction evidence unavailable");
    if (!finalizedSuccess || meta.err !== null)
      throw Error("No successful finalized execution evidence");
    if (array(tx.signatures)[0] !== signature)
      throw Error("Raw transaction identity mismatch");
    if (
      !Number.isSafeInteger(raw.slot) ||
      Number(raw.slot) < 0 ||
      !Number.isSafeInteger(raw.blockTime) ||
      Number(raw.blockTime) <= 0
    )
      throw Error("Missing raw transaction time/slot");
    if (
      raw.version !== undefined &&
      raw.version !== "legacy" &&
      raw.version !== 0 &&
      raw.version !== 1
    )
      throw Error("Unsupported transaction version");
    r.transactionVersion =
      raw.version === undefined ? null : (raw.version as "legacy" | 0 | 1);
    r.slot = Number(raw.slot);
    r.blockTime = Number(raw.blockTime) * 1000;
    const loaded = record(meta.loadedAddresses),
      staticKeys = array(msg.accountKeys);
    const keys = [
      ...staticKeys,
      ...array(loaded.writable),
      ...array(loaded.readonly),
    ];
    if (
      !keys.length ||
      keys.length > 256 ||
      new Set(keys).size !== keys.length ||
      keys.some(
        (k) =>
          typeof k !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(k),
      )
    )
      throw Error("Unsupported raw account keys");
    const key = (n: unknown): string => {
      if (
        !Number.isInteger(n) ||
        Number(n) < 0 ||
        typeof keys[Number(n)] !== "string"
      )
        throw Error("Invalid account index");
      return keys[Number(n)] as string;
    };
    const required = record(msg.header).numRequiredSignatures;
    if (
      !Number.isInteger(required) ||
      Number(required) < 1 ||
      Number(required) > staticKeys.length ||
      array(tx.signatures).length !== required
    )
      throw Error("Invalid signer header");
    r.signers = staticKeys.slice(0, Number(required)) as string[];
    if (
      !Array.isArray(meta.preTokenBalances) ||
      !Array.isArray(meta.postTokenBalances) ||
      !Array.isArray(meta.innerInstructions) ||
      !Array.isArray(msg.instructions)
    )
      throw Error("Incomplete raw movement evidence");
    type Balance = {
      mint: string;
      program: string;
      decimals: number;
      amount: string;
      owner: string | null;
    };
    const [pre, post] = [meta.preTokenBalances, meta.postTokenBalances].map(
      (side) => {
        const map = new Map<string, Balance>();
        for (const b of side.map(record)) {
          const account = key(b.accountIndex),
            a = record(b.uiTokenAmount);
          if (
            map.has(account) ||
            typeof b.mint !== "string" ||
            !Number.isInteger(a.decimals) ||
            Number(a.decimals) < 0 ||
            Number(a.decimals) > 18 ||
            typeof b.programId !== "string"
          )
            throw Error("Duplicate or invalid token balance");
          map.set(account, {
            mint: b.mint,
            program: b.programId,
            decimals: Number(a.decimals),
            amount: u64(a.amount),
            owner: typeof b.owner === "string" ? b.owner : null,
          });
        }
        return map;
      },
    );
    const states = new Map<string, TokenState>();
    for (const account of new Set([...pre.keys(), ...post.keys()])) {
      const p = pre.get(account),
        q = post.get(account),
        b = p ?? q!;
      if (
        p &&
        q &&
        (p.mint !== q.mint ||
          p.program !== q.program ||
          p.decimals !== q.decimals)
      )
        throw Error("Token account metadata changed");
      const issues: string[] = [];
      if (!p || !q) issues.push("Incomplete lifecycle balances");
      if (![TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(b.program))
        issues.push("Token extension/program semantics unresolved");
      if (p && q && p.owner !== q.owner) issues.push("Token authority changed");
      states.set(account, {
        account,
        mint: b.mint,
        tokenProgram: b.program,
        decimals: b.decimals,
        owner: p?.owner === q?.owner ? (p?.owner ?? null) : null,
        preRaw: p?.amount ?? null,
        postRaw: q?.amount ?? null,
        deltaRaw: p && q ? String(BigInt(q.amount) - BigInt(p.amount)) : null,
        issues,
      });
    }
    const mintMetadata = new Map<string, string>();
    for (const s of states.values()) {
      const metadata = `${s.tokenProgram}:${s.decimals}`;
      if (mintMetadata.has(s.mint) && mintMetadata.get(s.mint) !== metadata)
        throw Error("Conflicting mint metadata");
      mintMetadata.set(s.mint, metadata);
    }
    const entries = array(msg.instructions).map((ix, i) => ({
      ix: record(ix),
      index: i,
      inner: null as number | null,
    }));
    const seen = new Set<number>();
    for (const g of array(meta.innerInstructions).map(record)) {
      if (
        !Number.isInteger(g.index) ||
        Number(g.index) < 0 ||
        Number(g.index) >= array(msg.instructions).length ||
        seen.has(Number(g.index)) ||
        !Array.isArray(g.instructions)
      )
        throw Error("Invalid inner instruction group");
      seen.add(Number(g.index));
      g.instructions.forEach((ix, i) =>
        entries.push({ ix: record(ix), index: Number(g.index), inner: i }),
      );
    }
    if (entries.length > 2048)
      throw Error("Movement instruction limit exceeded");
    // Execution order is required for downstream CPI/domain explanations.
    entries.sort(
      (a, b) => a.index - b.index || (a.inner ?? -1) - (b.inner ?? -1),
    );
    for (const { ix, index, inner } of entries) {
      const program = key(ix.programIdIndex),
        accounts = array(ix.accounts).map(key);
      const normalized: RawInstruction = {
        instructionIndex: index,
        innerInstructionIndex: inner,
        stackHeight:
          inner === null
            ? 1
            : Number.isInteger(ix.stackHeight)
              ? Number(ix.stackHeight)
              : null,
        programId: program,
        accounts,
        tokenEffect: null,
      };
      r.instructions.push(normalized);
      if (program !== TOKEN_PROGRAM && program !== TOKEN_2022_PROGRAM) continue;
      const data = instructionBytes(ix.data),
        op = data[0];
      normalized.tokenOpcode = op;
      if ([1, 16, 18].includes(op)) {
        if (
          data.length !== (op === 1 ? 1 : 33) ||
          accounts.length < (op === 1 ? 4 : op === 16 ? 3 : 2)
        )
          throw Error("Invalid token initialization instruction");
        normalized.initializedOwner =
          op === 1 ? accounts[2] : publicKeyFromBytes(data.slice(1));
      }
      normalized.tokenEffect =
        op === 3 || op === 12
          ? "TRANSFER"
          : op === 7 || op === 14
            ? "MINT"
            : op === 8 || op === 15
              ? "BURN"
              : [1, 16, 18].includes(op)
                ? "INITIALIZE"
                : op === 9
                  ? "CLOSE"
                  : "OTHER";
      if (program === TOKEN_2022_PROGRAM) {
        normalized.initializesMint =
          op === 20 &&
          [35, 67].includes(data.length) &&
          data[1] <= 18 &&
          ((data[34] === 0 && data.length === 35) ||
            (data[34] === 1 && data.length === 67)) &&
          accounts.length === 1;
        let feeInit = false;
        if (op === 26 && data[1] === 0 && accounts.length === 1) {
          let at = 2;
          for (let option = 0; option < 2; option++) {
            const flag = data[at++];
            if (flag === 1) at += 32;
            else if (flag !== 0) {
              at = -100;
              break;
            }
          }
          feeInit =
            data.length === at + 10 && data[at] + data[at + 1] * 256 <= 10000;
        }
        const metadataInit =
          data
            .slice(0, 8)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("") === "d2e11ea258b84d8d" &&
          accounts.length === 4 &&
          accounts[0] === accounts[2];
        normalized.tokenAdministrative =
          !!normalized.initializesMint ||
          feeInit ||
          metadataInit ||
          (op === 39 &&
            data[1] === 0 &&
            data.length === 66 &&
            accounts.length === 1) ||
          (op === 6 &&
            data.length === 3 &&
            data[1] === 0 &&
            data[2] === 0 &&
            accounts.length === 2);
        if (op === 7 && data.length === 9 && accounts.length === 3)
          normalized.supplyAmountRaw = String(
            data.slice(1).reduceRight((n, b) => (n << 8n) + BigInt(b), 0n),
          );
      }
      normalized.harvestWithheld =
        program === TOKEN_2022_PROGRAM &&
        op === 26 &&
        data.length === 2 &&
        data[1] === 4;
      if (
        program === TOKEN_2022_PROGRAM &&
        ![9, 12, 18, 21, 22].includes(op) &&
        !normalized.harvestWithheld &&
        !normalized.tokenAdministrative &&
        normalized.supplyAmountRaw === undefined
      ) {
        r.issues.push("Token-2022 instruction semantics unresolved");
        continue;
      }
      if (op !== 3 && op !== 12) {
        if (
          !normalized.harvestWithheld &&
          !normalized.tokenAdministrative &&
          normalized.supplyAmountRaw === undefined &&
          ![1, 4, 5, 6, 9, 10, 11, 13, 16, 18, 21, 22].includes(op)
        )
          for (const account of accounts) {
            const s = states.get(account);
            if (s) s.issues.push("Non-transfer token operation");
          }
        continue;
      }
      const checked = op === 12,
        source = accounts[0],
        destination = accounts[checked ? 2 : 1];
      if (
        data.length !== (checked ? 10 : 9) ||
        accounts.length < (checked ? 4 : 3)
      )
        throw Error("Invalid token transfer instruction");
      const a = states.get(source),
        b = states.get(destination),
        mint = checked ? accounts[1] : (a?.mint ?? b?.mint ?? null);
      if (
        (a && b && (a.mint !== b.mint || a.decimals !== b.decimals)) ||
        [a, b].some(
          (s) => s && (s.tokenProgram !== program || s.mint !== mint),
        ) ||
        (checked && [a, b].some((s) => s && s.decimals !== data[9]))
      )
        throw Error("Conflicting transfer metadata");
      const decimals = checked ? data[9] : (a?.decimals ?? b?.decimals);
      if (mint && decimals !== undefined) {
        for (const account of [source, destination])
          if (!states.has(account))
            states.set(account, {
              account,
              mint,
              tokenProgram: program,
              decimals,
              owner: null,
              preRaw: null,
              postRaw: null,
              deltaRaw: null,
              issues: ["Missing endpoint balances"],
            });
      } else r.issues.push("Unattributed unchecked token transfer");
      const amount = data
        .slice(1, 9)
        .reduceRight((n, b) => (n << 8n) + BigInt(b), 0n);
      r.transfers.push({
        instructionIndex: index,
        innerInstructionIndex: inner,
        source,
        destination,
        authority: accounts[checked ? 3 : 2],
        mint,
        amountRaw: String(amount),
        tokenProgram: program,
      });
    }
    if (r.transfers.length > 256 || states.size > 128)
      throw Error("Movement record limit exceeded");
    // A missing pre-balance is zero only when raw execution proves a fresh
    // non-native token account, before every transfer, with matching ownership.
    for (const s of states.values()) {
      const inits = r.instructions.filter(
        (i) =>
          i.programId === s.tokenProgram &&
          i.tokenEffect === "INITIALIZE" &&
          i.accounts[0] === s.account,
      );
      const init = inits[0];
      const index = keys.indexOf(s.account);
      if (
        s.preRaw === null &&
        s.postRaw !== null &&
        s.mint !== WSOL_MINT &&
        inits.length === 1 &&
        init.accounts[1] === s.mint &&
        init.initializedOwner === post.get(s.account)?.owner &&
        array(meta.preBalances)[index] === 0 &&
        !r.instructions.some(
          (i) =>
            i.accounts[0] === s.account &&
            (i.tokenOpcode === 6 || i.tokenEffect === "CLOSE"),
        ) &&
        r.transfers
          .filter((t) => t.source === s.account || t.destination === s.account)
          .every(
            (t) =>
              r.instructions.findIndex(
                (i) =>
                  i.instructionIndex === t.instructionIndex &&
                  i.innerInstructionIndex === t.innerInstructionIndex,
              ) > r.instructions.indexOf(init),
          )
      ) {
        s.preRaw = "0";
        s.deltaRaw = s.postRaw;
        s.owner = init.initializedOwner!;
        s.issues = s.issues.filter(
          (i) => i !== "Incomplete lifecycle balances",
        );
      }
    }
    // A successful non-native close requires a zero base token balance.
    // Withheld extension amounts are separate from that base balance.
    for (const s of states.values()) {
      const closes = r.instructions.filter(
        (i) =>
          i.programId === s.tokenProgram &&
          i.tokenEffect === "CLOSE" &&
          i.accounts[0] === s.account,
      );
      const close = closes[0],
        before = pre.get(s.account);
      if (
        s.mint === WSOL_MINT ||
        s.postRaw !== null ||
        s.preRaw === null ||
        closes.length !== 1 ||
        !before?.owner ||
        close.accounts[2] !== before.owner ||
        array(meta.postBalances)[keys.indexOf(s.account)] !== 0 ||
        r.instructions.some(
          (i) =>
            i.accounts[0] === s.account &&
            (i.tokenOpcode === 6 || i.tokenEffect === "INITIALIZE"),
        )
      )
        continue;
      const last = r.instructions.indexOf(close);
      if (
        !r.transfers
          .filter((t) => t.source === s.account || t.destination === s.account)
          .every(
            (t) =>
              r.instructions.findIndex(
                (i) =>
                  i.instructionIndex === t.instructionIndex &&
                  i.innerInstructionIndex === t.innerInstructionIndex,
              ) < last,
          )
      )
        continue;
      s.postRaw = "0";
      s.deltaRaw = String(-BigInt(s.preRaw));
      s.owner = before.owner;
      s.issues = s.issues.filter((i) => i !== "Incomplete lifecycle balances");
    }
    const minted = new Map<string, bigint>();
    for (const i of r.instructions.filter(
      (i) => i.supplyAmountRaw !== undefined,
    )) {
      const state = states.get(i.accounts[1]);
      if (
        !state ||
        state.mint !== i.accounts[0] ||
        state.tokenProgram !== i.programId
      )
        throw Error("Conflicting mint-to metadata");
      minted.set(
        state.account,
        (minted.get(state.account) ?? 0n) + BigInt(i.supplyAmountRaw!),
      );
    }
    // Observe net credit for one isolated Token-2022 checked transfer per mint.
    // Never infer a fee rate/configuration from a balance difference. Hooks,
    // multiple transfers and missing balances remain unresolved. A verified
    // MintTo amount is included in the source account's balance reconciliation.
    for (const t of r.transfers.filter(
      (t) => t.tokenProgram === TOKEN_2022_PROGRAM,
    )) {
      const a = states.get(t.source),
        b = states.get(t.destination);
      const at = r.instructions.findIndex(
        (i) =>
          i.instructionIndex === t.instructionIndex &&
          i.innerInstructionIndex === t.innerInstructionIndex,
      );
      const ix = r.instructions[at],
        next = r.instructions[at + 1];
      const isolated =
        r.transfers.filter((x) => x.mint === t.mint).length === 1 &&
        !r.instructions.some(
          (i) =>
            i.programId === TOKEN_2022_PROGRAM &&
            ![9, 12, 18, 21, 22].includes(i.tokenOpcode ?? -1) &&
            !i.harvestWithheld &&
            !i.tokenAdministrative &&
            i.supplyAmountRaw === undefined,
        ) &&
        ix.stackHeight !== null &&
        !(
          next &&
          next.instructionIndex === ix.instructionIndex &&
          (next.stackHeight === null || next.stackHeight > ix.stackHeight)
        );
      if (
        isolated &&
        a?.deltaRaw ===
          String((minted.get(t.source) ?? 0n) - BigInt(t.amountRaw)) &&
        b?.deltaRaw !== null &&
        b?.deltaRaw !== undefined &&
        BigInt(b.deltaRaw) >= 0n &&
        BigInt(b.deltaRaw) <= BigInt(t.amountRaw) &&
        t.source !== t.destination &&
        !a.issues.length &&
        !b.issues.length
      ) {
        t.receivedAmountRaw = b.deltaRaw;
        t.observedFeeRaw = String(BigInt(t.amountRaw) - BigInt(b.deltaRaw));
      } else {
        r.issues.push("Token-2022 transfer credit unresolved");
      }
    }
    const net = new Map<string, bigint>(minted);
    for (const t of r.transfers) {
      net.set(t.source, (net.get(t.source) ?? 0n) - BigInt(t.amountRaw));
      net.set(
        t.destination,
        (net.get(t.destination) ?? 0n) +
          BigInt(t.receivedAmountRaw ?? t.amountRaw),
      );
    }
    for (const s of states.values()) {
      if (
        s.deltaRaw !== null &&
        BigInt(s.deltaRaw) !== (net.get(s.account) ?? 0n)
      )
        s.issues.push("Transfer/balance mismatch");
      s.issues = [...new Set(s.issues)];
    }
    r.tokenStates = [...states.values()];
    // Exact lamport observation, with network fee correction only. Rent, tips,
    // WSOL backing and direct program debits are deliberately not conflated.
    try {
      const p = array(meta.preBalances),
        q = array(meta.postBalances);
      if (p.length !== keys.length || q.length !== keys.length)
        throw Error("Native balance arrays unavailable");
      const fee = u64(meta.fee);
      r.native.feeRaw = fee;
      r.native.balances = keys.map((_, i) => {
        const before = u64(p[i]),
          after = u64(q[i]),
          delta = BigInt(after) - BigInt(before);
        return {
          account: key(i),
          preRaw: before,
          postRaw: after,
          deltaRaw: String(delta),
          feeAdjustedDeltaRaw: String(delta + (i === 0 ? BigInt(fee) : 0n)),
        };
      });
      if (
        r.native.balances.reduce(
          (sum, b) => sum + BigInt(b.deltaRaw),
          BigInt(fee),
        ) !== 0n
      )
        r.native.issues.push("Lamport conservation mismatch");
      if (
        r.instructions.some(
          (i) => i.tokenEffect === "INITIALIZE" || i.tokenEffect === "CLOSE",
        ) ||
        r.tokenStates.some((s) => s.mint === WSOL_MINT)
      )
        r.native.issues.push("Rent/WSOL consideration requires reconciliation");
    } catch {
      r.native.feeRaw = null;
      r.native.balances = [];
      r.native.issues = ["Native balance evidence unavailable or unsafe"];
    }
    r.issues = [...new Set(r.issues)];
    r.status =
      r.issues.length || r.tokenStates.some((s) => s.issues.length)
        ? "PARTIAL"
        : "RECONCILED";
  } catch (e) {
    r.status = "UNAVAILABLE";
    r.tokenStates = [];
    r.transfers = [];
    r.instructions = [];
    r.signers = [];
    r.issues = [e instanceof Error ? e.message : "Invalid raw evidence"];
    r.native = {
      feeRaw: null,
      balances: [],
      issues: ["Native evidence unavailable"],
    };
  }
  return r;
}
