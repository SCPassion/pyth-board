import { PublicKey } from "@solana/web3.js";

/** Decode only the owner/u64 slice; fail the whole collection on malformed data. */
export function countPythHolders(accounts: unknown, owners = new Set<string>()) {
  if (!Array.isArray(accounts)) throw new Error("Missing token account array");
  let positiveTokenAccounts = 0;
  for (const entry of accounts) {
    const encoded = entry?.account?.data;
    if (!Array.isArray(encoded) || encoded.length !== 2 || encoded[1] !== "base64" ||
      typeof encoded[0] !== "string") {
      throw new Error("Malformed token account data");
    }
    const data = Buffer.from(encoded[0], "base64");
    if (data.toString("base64") !== encoded[0]) throw new Error("Invalid base64 data");
    if (data.length !== 40) throw new Error(`Unexpected token account slice length: ${data.length}`);
    const amount = data.readBigUInt64LE(32);
    if (amount === 0n) continue;
    // Flatten base58 string ropes before retaining hundreds of thousands of keys.
    owners.add(Buffer.from(new PublicKey(data.subarray(0, 32)).toBase58(), "ascii").toString("ascii"));
    positiveTokenAccounts++;
  }
  return { holders: owners.size, totalTokenAccounts: accounts.length, positiveTokenAccounts };
}
