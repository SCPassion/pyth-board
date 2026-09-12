import { POSITION_DISCRIMINATOR, STAKING_PROGRAM } from "../lib/growth/governanceStakers";
export type Position = { amount?: bigint; activation?: bigint; unlocking?: bigint; ois?: boolean } | null;
export function stakeData(owner = 1, positions: Position[] = [{}]) {
  const data = Buffer.alloc(40 + 200 * positions.length);
  POSITION_DISCRIMINATOR.copy(data); data.fill(owner, 8, 40);
  positions.forEach((p, i) => {
    if (!p) return;
    const o = 40 + i * 200;
    data[o] = 1; data.writeBigUInt64LE(p.amount ?? 1n, o + 1);
    data.writeBigUInt64LE(p.activation ?? 1n, o + 9);
    data[o + 17] = p.unlocking === undefined ? 0 : 1;
    if (p.unlocking !== undefined) data.writeBigUInt64LE(p.unlocking, o + 18);
    data[o + (p.unlocking === undefined ? 18 : 26)] = p.ois ? 1 : 0;
  });
  return data;
}
export const entry = (owner = 1, positions?: Position[]) => ({ account: {
  owner: STAKING_PROGRAM, executable: false, data: [stakeData(owner, positions).toString("base64"), "base64"],
} });
