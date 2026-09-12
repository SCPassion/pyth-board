import * as zlib from "node:zlib";

/** Layout verified against staking-sdk 0.3.0 IDL and Pyth PositionData. */
export const STAKING_PROGRAM = "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ";
export const POSITION_DISCRIMINATOR = Buffer.from([85, 195, 241, 79, 124, 192, 79, 11]);
export const PYTH_EPOCH_SECONDS = 604800n;
// Optional native support keeps Node 20 compatibility without another dependency.
const decompress = (zlib as unknown as { zstdDecompressSync?: (data: Buffer, options: { maxOutputLength: number; chunkSize: number }) => Buffer }).zstdDecompressSync;
export const STAKING_ENCODING = typeof decompress === "function" ? "base64+zstd" : "base64";

export function decodeGovernanceStake(data: Buffer, epoch: bigint) {
  if (data.length < 40 ||
      !data.subarray(0, 8).equals(POSITION_DISCRIMINATOR)) {
    throw new Error(`Malformed staking account layout: ${data.length} bytes, discriminator ${data.subarray(0, 8).toString("hex")}`);
  }
  // The program/SDK use floor((length - 40) / 200). Live accounts include
  // a 64-byte empty allocation. Accept only zero-filled unused tail bytes;
  // an incomplete occupied position must still fail the entire collection.
  const end = 40 + Math.floor((data.length - 40) / 200) * 200;
  if (data.subarray(end).some(byte => byte !== 0)) throw new Error("Truncated staking position");
  let votingAmount = 0n;
  for (let offset = 40; offset < end; offset += 200) {
    const occupied = data[offset];
    if (occupied === 0) continue;
    if (occupied !== 1) throw new Error("Malformed position option");
    const amount = data.readBigUInt64LE(offset + 1);
    const activation = data.readBigUInt64LE(offset + 9);
    const unlockingTag = data[offset + 17];
    if (unlockingTag !== 0 && unlockingTag !== 1) throw new Error("Malformed unlocking option");
    const unlocking = unlockingTag === 1 ? data.readBigUInt64LE(offset + 18) : null;
    const target = data[offset + (unlockingTag === 1 ? 26 : 18)];
    if (target !== 0 && target !== 1) throw new Error("Unknown staking target");
    // LOCKED or PREUNLOCKING only. Do not interpret epoch zero as None.
    if (target === 0 && activation <= epoch && (unlocking === null || epoch < unlocking)) {
      votingAmount += amount;
    }
  }
  // Fixed-length hex avoids retained base58 string ropes and needs no SDK at runtime.
  return { owner: data.subarray(8, 40).toString("hex"), votingAmount };
}

export function decodeStakeEntry(entry: unknown, epoch: bigint) {
  const account = (entry as { account?: { owner?: unknown; data?: unknown; executable?: unknown } })?.account;
  const encoded = account?.data;
  if (account?.owner !== STAKING_PROGRAM || account.executable !== false ||
      !Array.isArray(encoded) || encoded.length !== 2 || (encoded[1] !== "base64" && encoded[1] !== "base64+zstd") || typeof encoded[0] !== "string") {
    throw new Error("Malformed staking RPC account");
  }
  const packed = Buffer.from(encoded[0], "base64");
  if (packed.toString("base64") !== encoded[0]) throw new Error("Malformed staking base64");
  let data: Buffer = packed;
  if (encoded[1] === "base64+zstd") {
    if (!decompress) throw new Error("Native Zstandard is unavailable");
    try { data = decompress(packed, { maxOutputLength: 1024 * 1024, chunkSize: 4096 }); }
    catch { throw new Error("Malformed compressed staking account"); }
  }
  return { ...decodeGovernanceStake(data, epoch), data };
}
