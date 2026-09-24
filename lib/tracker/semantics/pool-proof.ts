import { temporaryOwners } from "./temporary-accounts";
import { array, record } from "../helius-format";
import {
  instructionBytes,
  TOKEN_PROGRAM,
  TOKEN_2022_PROGRAM,
  type NormalizedTransaction,
  type RawInstruction,
  type AssetTransfer,
} from "../normalize";
export const CLMM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
export const WHIRLPOOL = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
export const DLMM = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
export const CPMM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
export const LAUNCHLAB = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
export const DAMM_V2 = "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG";
export type PoolProof = {
  fees: AssetTransfer[];
  inputOwner: string;
  outputOwner: string;
  ix: RawInstruction;
  input: AssetTransfer;
  output: AssetTransfer;
  authority: string;
  descendants: RawInstruction[];
  name: string;
};
/** Exact supported pool layouts. Unknown instructions and CPI subtrees do not attest an exchange. */
export function attestPoolSwaps(
  rawValue: unknown,
  n: NormalizedTransaction,
): PoolProof[] {
  if (n.status === "UNAVAILABLE" || n.issues.length) return [];
  const raw = record(rawValue),
    message = record(record(raw.transaction).message),
    meta = record(raw.meta);
  const states = new Map(n.tokenStates.map((s) => [s.account, s]));
  const temporary = temporaryOwners(n);
  const owner = (account: string) =>
    states.get(account)?.owner ?? temporary.get(account);
  const sound = (account: string) => {
    const s = states.get(account);
    return (
      s &&
      (!s.issues.length ||
        (temporary.has(account) &&
          s.issues.every((i) => i === "Missing endpoint balances") &&
          (s.mint === "So11111111111111111111111111111111111111112" ||
            n.transfers.reduce(
              (v, t) =>
                v +
                (t.destination === account ? BigInt(t.amountRaw) : 0n) -
                (t.source === account ? BigInt(t.amountRaw) : 0n),
              0n,
            ) === 0n)))
    );
  };
  const bytes = (i: RawInstruction) => {
    const source =
      i.innerInstructionIndex === null
        ? record(array(message.instructions)[i.instructionIndex])
        : record(
            array(
              record(
                array(meta.innerInstructions)
                  .map(record)
                  .find((g) => g.index === i.instructionIndex),
              ).instructions,
            )[i.innerInstructionIndex],
          );
    try {
      return instructionBytes(
        source.data,
        i.programId === DAMM_V2 && i.accounts.length === 1 ? 512 : 256,
      );
    } catch {
      return [];
    }
  };
  const hex = (b: number[]) =>
    b.map((x) => x.toString(16).padStart(2, "0")).join("");
  const proofs: PoolProof[] = [];
  for (let at = 0; at < n.instructions.length; at++) {
    const ix = n.instructions[at],
      a = ix.accounts;
    if (
      ![CLMM, WHIRLPOOL, LAUNCHLAB, DLMM, CPMM, DAMM_V2].includes(ix.programId) ||
      !ix.stackHeight
    )
      continue;
    const source =
      ix.innerInstructionIndex === null
        ? record(array(message.instructions)[ix.instructionIndex])
        : record(
            array(
              record(
                array(meta.innerInstructions)
                  .map(record)
                  .find((g) => g.index === ix.instructionIndex),
              ).instructions,
            )[ix.innerInstructionIndex],
          );
    let data: number[];
    try {
      data = instructionBytes(source.data);
    } catch {
      continue;
    }
    const discriminator = data
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const launch = ix.programId === LAUNCHLAB;
    const v2 =
      [CLMM, WHIRLPOOL].includes(ix.programId) &&
      discriminator === "2b04ed0b1ac91e62";
    if (
      ix.programId === CPMM
        ? discriminator !== "8fbe5adac41e33de"
        : launch
          ? !["9527de9bd37c981a", "faea0d7bd59c13ec"].includes(discriminator)
          : (!v2 && discriminator !== "f8c69e91e17587c8") ||
            (ix.programId !== DLMM && data[40] > 1)
    )
      continue;
    let authority: string,
      pool: string,
      userIn: string,
      userOut: string,
      vaultIn: string,
      vaultOut: string;
    if (ix.programId === DAMM_V2) {
      if (
        data.length !== 24 ||
        a.length !== 14 ||
        a[13] !== DAMM_V2 ||
        ![TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(a[9]) ||
        ![TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(a[10]) ||
        states.get(a[4])?.mint !== a[6] ||
        states.get(a[5])?.mint !== a[7] ||
        states.get(a[4])?.tokenProgram !== a[9] ||
        states.get(a[5])?.tokenProgram !== a[10]
      )
        continue;
      [authority, pool, userIn, userOut] = [a[8], a[0], a[2], a[3]];
      [vaultIn, vaultOut] =
        states.get(userIn)?.mint === a[6] ? [a[4], a[5]] : [a[5], a[4]];
    } else if (ix.programId === CPMM) {
      if (
        data.length !== 24 ||
        a.length !== 13 ||
        ![TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(a[8]) ||
        ![TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(a[9])
      )
        continue;
      [authority, pool, userIn, userOut, vaultIn, vaultOut] = [
        a[0],
        a[1],
        a[4],
        a[5],
        a[6],
        a[7],
      ];
      if (
        states.get(vaultIn)?.mint !== a[10] ||
        states.get(vaultOut)?.mint !== a[11] ||
        states.get(vaultIn)?.tokenProgram !== a[8] ||
        states.get(vaultOut)?.tokenProgram !== a[9]
      )
        continue;
    } else if (ix.programId === DLMM) {
      if (
        data.length !== 24 ||
        a.length < 15 ||
        a[9] !== DLMM ||
        a[14] !== DLMM ||
        a[11] !== TOKEN_PROGRAM ||
        a[12] !== TOKEN_PROGRAM ||
        states.get(a[2])?.mint !== a[6] ||
        states.get(a[3])?.mint !== a[7]
      )
        continue;
      [authority, pool, userIn, userOut] = [a[10], a[0], a[4], a[5]];
      [vaultIn, vaultOut] =
        states.get(userIn)?.mint === a[6] ? [a[2], a[3]] : [a[3], a[2]];
    } else if (launch) {
      if (
        data.length !== 32 ||
        a.length !== 18 ||
        a[14] !== LAUNCHLAB ||
        a[15] !== "11111111111111111111111111111111" ||
        ![TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(a[11]) ||
        a[12] !== TOKEN_PROGRAM
      )
        continue;
      [authority, pool] = [a[0], a[1]];
      [userIn, vaultIn, userOut, vaultOut] =
        discriminator === "9527de9bd37c981a"
          ? [a[5], a[7], a[6], a[8]]
          : [a[6], a[8], a[5], a[7]];
      if (
        states.get(a[7])?.mint !== a[9] ||
        states.get(a[8])?.mint !== a[10] ||
        states.get(a[7])?.tokenProgram !== a[11]
      )
        continue;
    } else if (ix.programId === CLMM) {
      if (
        data.length !== 41 ||
        a.length < (v2 ? 13 : 10) ||
        a[8] !== TOKEN_PROGRAM ||
        (v2 &&
          (a[9] !== TOKEN_2022_PROGRAM ||
            states.get(a[5])?.mint !== a[11] ||
            states.get(a[6])?.mint !== a[12]))
      )
        continue;
      [authority, pool, userIn, userOut, vaultIn, vaultOut] = [
        a[0],
        a[2],
        a[3],
        a[4],
        a[5],
        a[6],
      ];
    } else if (v2) {
      if (
        data.length !== 43 ||
        data[41] > 1 ||
        data[42] !== 0 ||
        a.length < 15 ||
        a[0] !== TOKEN_PROGRAM ||
        a[1] !== TOKEN_PROGRAM ||
        states.get(a[8])?.mint !== a[5] ||
        states.get(a[10])?.mint !== a[6]
      )
        continue;
      [authority, pool] = [a[3], a[4]];
      [userIn, vaultIn, userOut, vaultOut] =
        data[41] === 1 ? [a[7], a[8], a[9], a[10]] : [a[9], a[10], a[7], a[8]];
    } else {
      if (
        data.length !== 42 ||
        data[41] > 1 ||
        a.length < 11 ||
        a[0] !== TOKEN_PROGRAM
      )
        continue;
      [authority, pool] = [a[1], a[2]];
      [userIn, vaultIn, userOut, vaultOut] =
        data[41] === 1 ? [a[3], a[4], a[5], a[6]] : [a[5], a[6], a[3], a[4]];
    }
    const emptyCreatorFee = (account: string) =>
      launch &&
      account === a[17] &&
      states.get(account)?.preRaw === null &&
      states.get(account)?.postRaw === "0" &&
      n.native.balances.find((b) => b.account === account)?.preRaw === "0" &&
      !n.transfers.some(
        (t) => t.source === account || t.destination === account,
      );
    const freshMint = (mint: string) => {
      const inits = n.instructions.filter(
        (i) => i.initializesMint && i.accounts[0] === mint,
      );
      return (
        launch &&
        inits.length === 1 &&
        inits[0].instructionIndex < ix.instructionIndex &&
        n.native.balances.find((b) => b.account === mint)?.preRaw === "0"
      );
    };
    if (
      n.instructions.some((i) => {
        if (i.tokenEffect === "BURN") return true;
        if (i.tokenEffect === "MINT")
          return !(
            i.supplyAmountRaw !== undefined &&
            freshMint(i.accounts[0]) &&
            [vaultIn, vaultOut].includes(i.accounts[1]) &&
            i.instructionIndex < ix.instructionIndex
          );
        if (i.tokenOpcode === 6)
          return (
            !(i.tokenAdministrative && freshMint(i.accounts[0])) &&
            !(
              emptyCreatorFee(i.accounts[0]) &&
              i.instructionIndex === ix.instructionIndex &&
              bytes(i).length === 35 &&
              bytes(i)[1] === 2 &&
              bytes(i)[2] === 1 &&
              i.accounts[1] === pool
            )
          );
        return false;
      })
    )
      continue;
    // Successful raw CPI establishes signer/PDA authority. Beneficial ownership
    // is checked separately by the trade or intermediate-path consumer.
    const descendants: typeof n.instructions = [];
    let ambiguous = false;
    for (let j = at + 1; j < n.instructions.length; j++) {
      const child = n.instructions[j];
      if (child.instructionIndex !== ix.instructionIndex) break;
      if (child.stackHeight === null) {
        ambiguous = true;
        break;
      }
      if (child.stackHeight <= ix.stackHeight) break;
      descendants.push(child);
    }
    const transferChildren = descendants.filter(
      (c) => c.tokenEffect === "TRANSFER",
    );
    if (
      ambiguous ||
      transferChildren.length < 2 ||
      transferChildren.length > (launch ? 4 : 2) ||
      descendants.some((c) => {
        if (c.stackHeight !== ix.stackHeight! + 1) return true;
        if (
          c.tokenEffect === "TRANSFER" &&
          [TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(c.programId)
        )
          return false;
        if (
          emptyCreatorFee(c.accounts[0]) &&
          c.programId === TOKEN_PROGRAM &&
          ((c.tokenEffect === "INITIALIZE" &&
            c.initializedOwner === pool &&
            c.accounts[1] === a[10]) ||
            (c.tokenOpcode === 6 && c.accounts[1] === pool))
        )
          return false;
        if (
          launch &&
          c.programId === "11111111111111111111111111111111" &&
          c.accounts[0] === authority &&
          c.accounts.length === 2 &&
          emptyCreatorFee(c.accounts[1])
        ) {
          const b = bytes(c);
          if (
            b.length === 52 &&
            b.slice(0, 4).every((x) => x === 0) &&
            hex(b.slice(20)) === hex(instructionBytes(TOKEN_PROGRAM))
          )
            return false;
        }
        return !(
          (launch || ix.programId === DLMM || ix.programId === DAMM_V2) &&
          c.programId === ix.programId &&
          c.accounts.length === 1 &&
          c.accounts[0] === (ix.programId === DAMM_V2 ? a[12] : a[13]) &&
          hex(bytes(c).slice(0, 8)) === "e445a52e51cb9a1d"
        );
      })
    )
      continue;
    const ts = n.transfers.filter((t) =>
      descendants.some(
        (c) =>
          c.instructionIndex === t.instructionIndex &&
          c.innerInstructionIndex === t.innerInstructionIndex,
      ),
    );
    const input = ts.find(
      (t) =>
        t.source === userIn &&
        t.destination === vaultIn &&
        t.authority === authority,
    );
    const output = ts.find(
      (t) =>
        t.source === vaultOut &&
        t.destination === userOut &&
        t.authority === pool,
    );
    if (
      !input?.mint ||
      !output?.mint ||
      input.mint === output.mint ||
      new Set([userIn, userOut, vaultIn, vaultOut]).size !== 4
    )
      continue;
    if (
      owner(userIn) !== authority ||
      !owner(userOut) ||
      states.get(vaultIn)?.owner !== pool ||
      states.get(vaultOut)?.owner !== pool
    )
      continue;
    if (BigInt(input.amountRaw) <= 0n || BigInt(output.amountRaw) <= 0n)
      continue;
    if (![userIn, userOut, vaultIn, vaultOut].every(sound)) continue;
    const fees = ts.filter((t) => t !== input && t !== output);
    if (
      fees.some(
        (t) =>
          !launch ||
          t.source !== a[8] ||
          ![a[16], a[17]].includes(t.destination) ||
          t.authority !== pool ||
          t.mint !== a[10] ||
          !sound(t.destination) ||
          owner(t.destination) === authority,
      )
    )
      continue;
    proofs.push({
      fees,
      inputOwner: owner(userIn)!,
      outputOwner: owner(userOut)!,
      ix,
      input,
      output,
      authority,
      descendants,
      name:
        ix.programId === DAMM_V2
          ? "Meteora DAMM v2"
          : ix.programId === DLMM
          ? "Meteora DLMM"
          : ix.programId === CPMM
            ? "Raydium CPMM"
            : launch
              ? "Raydium LaunchLab"
              : ix.programId === CLMM
                ? "Raydium CLMM"
                : "Orca Whirlpool",
    });
  }
  return proofs;
}
