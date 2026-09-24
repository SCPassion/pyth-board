import { array, record } from "../helius-format";
import {
  instructionBytes,
  TOKEN_PROGRAM,
  type NormalizedTransaction,
} from "../normalize";
export const DCA_PROGRAM = "DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M";
// Jupiter @jup-ag/dca-sdk 3.0.1 IDL; Anchor global instruction discriminators.
const layouts = {
  "8fcd03bfa2d7f531": { kind: "START", bytes: 8, count: 10, token: 8 },
  "7340e24e21d369a2": { kind: "EXECUTION", bytes: 16, count: 15, token: 11 },
  a334c8e78c0345ba: { kind: "WITHDRAWAL", bytes: 8, count: 12, token: 8 },
} as const;
type Call = {
  kind: (typeof layouts)[keyof typeof layouts]["kind"];
  index: number;
  accounts: string[];
};
export type PositionOperation = {
  programId: string;
  position: string;
  kind: "EXECUTION" | "WITHDRAWAL";
  instructionIndex: number;
  startInstructionIndex: number | null;
  vaults: string[];
  owner: string | null;
  movements: { mint: string; amountRaw: string; direction: "IN" | "OUT" }[];
  status: "VERIFIED" | "UNRESOLVED";
  issues: string[];
};
/** Semantic evidence only. A keeper is never treated as the beneficial owner,
 * and a withdrawal is never emitted as a new swap. Unknown layouts stay unresolved. */
export function analyzeDcaPositions(
  value: unknown,
  n: NormalizedTransaction,
): PositionOperation[] {
  if (n.status === "UNAVAILABLE") return [];
  const raw = record(value),
    message = record(record(raw.transaction).message),
    meta = record(raw.meta),
    loaded = record(meta.loadedAddresses);
  const keys = [
    ...array(message.accountKeys),
    ...array(loaded.writable),
    ...array(loaded.readonly),
  ];
  const balances = [
    ...array(meta.preTokenBalances),
    ...array(meta.postTokenBalances),
  ].map(record);
  const owns = (account: string, owner: string, mint?: string) => {
    const rows = balances.filter(
      (b) => keys[Number(b.accountIndex)] === account,
    );
    return (
      !n.instructions.some(
        (i) =>
          i.programId === TOKEN_PROGRAM &&
          i.tokenOpcode === 6 &&
          i.accounts[0] === account,
      ) &&
      rows.length > 0 &&
      rows.every(
        (b) =>
          b.owner === owner &&
          b.programId === TOKEN_PROGRAM &&
          (!mint || b.mint === mint),
      )
    );
  };
  const calls: Call[] = [];
  for (const i of n.instructions.filter(
    (i) => i.programId === DCA_PROGRAM && i.innerInstructionIndex === null,
  )) {
    try {
      const data = instructionBytes(
        record(array(message.instructions)[i.instructionIndex]).data,
      );
      const hex = data
        .slice(0, 8)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const layout = layouts[hex as keyof typeof layouts];
      if (
        !layout ||
        data.length !== layout.bytes ||
        i.accounts.length < layout.count ||
        i.accounts[layout.token] !== TOKEN_PROGRAM
      )
        continue;
      if (!n.signers.includes(i.accounts[0])) continue;
      calls.push({
        kind: layout.kind,
        index: i.instructionIndex,
        accounts: i.accounts,
      });
    } catch {
      /* Unrecognized raw evidence never establishes a position relationship. */
    }
  }
  const out: PositionOperation[] = [];
  for (const call of calls.filter((c) => c.kind !== "START")) {
    const a = call.accounts,
      position = a[1],
      issues: string[] = [],
      movements: PositionOperation["movements"] = [];
    let vaults: string[] = [],
      owner: string | null = null,
      startInstructionIndex: number | null = null;
    const scoped = (index: number) =>
      n.transfers.filter(
        (t) => t.instructionIndex === index && t.innerInstructionIndex !== null,
      );
    if (call.kind === "EXECUTION") {
      const previousEnd = Math.max(
        -1,
        ...calls
          .filter(
            (c) =>
              c.kind === "EXECUTION" &&
              c.accounts[1] === position &&
              c.index < call.index,
          )
          .map((c) => c.index),
      );
      const starts = calls.filter(
        (c) =>
          c.kind === "START" &&
          c.index < call.index &&
          c.index > previousEnd &&
          c.accounts[1] === position,
      );
      const start = starts.at(-1);
      vaults = [a[5], a[6]];
      if (
        starts.length !== 1 ||
        !start ||
        start.accounts[0] !== a[0] ||
        start.accounts[2] !== a[2] ||
        start.accounts[3] !== a[4] ||
        start.accounts[4] !== a[5] ||
        start.accounts[5] !== a[6] ||
        calls.some(
          (c) =>
            c.kind === "EXECUTION" &&
            c.accounts[1] === position &&
            start.index < c.index &&
            c.index < call.index,
        )
      )
        issues.push("Missing unique matching flash-fill boundary");
      if (
        !owns(a[5], position, a[2]) ||
        !owns(a[6], position, a[3]) ||
        a[2] === a[3] ||
        a[5] === a[6]
      )
        issues.push("Vault ownership or mint mismatch");
      if (start) {
        startInstructionIndex = start.index;
        const input = scoped(start.index).filter(
          (t) =>
            t.source === a[5] &&
            t.destination === a[4] &&
            t.authority === position &&
            t.mint === a[2],
        );
        const output = n.transfers.filter(
          (t) =>
            t.instructionIndex > start.index &&
            t.instructionIndex <= call.index &&
            t.innerInstructionIndex !== null &&
            t.destination === a[6] &&
            t.authority === a[0] &&
            t.mint === a[3] &&
            owns(t.source, a[0], a[3]),
        );
        const sum = (ts: typeof input) =>
          String(ts.reduce((s, t) => s + BigInt(t.amountRaw), 0n));
        if (
          !input.length ||
          !output.length ||
          sum(input) === "0" ||
          sum(output) === "0"
        )
          issues.push("Missing vault debit or repayment transfer");
        else
          movements.push(
            { mint: a[2], amountRaw: sum(input), direction: "OUT" },
            { mint: a[3], amountRaw: sum(output), direction: "IN" },
          );
      }
    } else {
      const vault = a[4],
        userAccount = a[5];
      owner = a[2];
      vaults = [vault];
      const candidates = scoped(call.index).filter(
        (t) =>
          t.source === vault &&
          t.destination === userAccount &&
          t.authority === position,
      );
      const mint = a[3];
      if (
        !mint ||
        !owns(vault, position, mint) ||
        !owns(userAccount, owner, mint) ||
        !candidates.length ||
        candidates.some((t) => t.mint !== mint)
      )
        issues.push("Unverified vault/user transfer roles");
      else
        movements.push({
          mint,
          amountRaw: String(
            candidates.reduce((s, t) => s + BigInt(t.amountRaw), 0n),
          ),
          direction: "OUT",
        });
    }
    out.push({
      programId: DCA_PROGRAM,
      position,
      kind: call.kind as PositionOperation["kind"],
      instructionIndex: call.index,
      startInstructionIndex,
      vaults,
      owner,
      movements,
      status: issues.length ? "UNRESOLVED" : "VERIFIED",
      issues,
    });
  }
  return out;
}
