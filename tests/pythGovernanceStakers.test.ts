import { describe, expect, it } from "vitest";
import { decodeGovernanceStake, decodeStakeEntry } from "../lib/growth/governanceStakers";
import { stakeData, entry } from "./governanceFixtures";

describe("governance positions", () => {
  it.each([
    [{ activation: 11n }, 0n], [{ activation: 10n }, 1n],
    [{ unlocking: 11n }, 1n], [{ unlocking: 10n }, 0n], [{ unlocking: 9n }, 0n],
    [{ unlocking: 0n }, 0n], [{ amount: 0n }, 0n], [{ ois: true }, 0n],
    [{ amount: 2n ** 64n - 1n }, 2n ** 64n - 1n],
  ])("evaluates state and amount case %#", (position, amount) => {
    expect(decodeGovernanceStake(stakeData(1, [position]), 10n).votingAmount).toBe(amount);
  });
  it("inspects later positions and ignores OIS and empty slots", () => {
    expect(decodeGovernanceStake(stakeData(1, [null, { ois: true }, { amount: 5n }, {}]), 10n).votingAmount).toBe(6n);
    expect(decodeGovernanceStake(stakeData(1, []), 10n).votingAmount).toBe(0n);
  });
  it.each([0, 40, 57, 58])("rejects corrupt discriminator/options/targets at %i", offset => {
    const data = stakeData(); data[offset] = 255;
    expect(() => decodeGovernanceStake(data, 10n)).toThrow();
  });
  it("accepts zero-filled allocation padding but rejects incomplete occupied slots", () => {
    const empty = Buffer.concat([stakeData(1, []), Buffer.alloc(24)]);
    expect(decodeGovernanceStake(empty, 10n).votingAmount).toBe(0n);
    empty[40] = 1;
    expect(() => decodeGovernanceStake(empty, 10n)).toThrow("Truncated");
  });
  it("rejects truncation and malformed RPC wrappers", () => {
    expect(() => decodeGovernanceStake(stakeData().subarray(0, 239), 10n)).toThrow();
    const e = entry(); e.account.data[0] += "!";
    expect(() => decodeStakeEntry(e, 10n)).toThrow();
    expect(() => decodeStakeEntry({ account: { ...entry().account, owner: "wrong" } }, 10n)).toThrow();
  });
});

import * as zlib from "node:zlib";
const compress = (zlib as unknown as { zstdCompressSync?: (data: Buffer) => Buffer }).zstdCompressSync;
it.skipIf(!compress)("decodes lossless compressed accounts and rejects corrupt/oversized frames", () => {
  const e = entry(1, [{ amount: 9n }]);
  e.account.data = [compress!(stakeData(1, [{ amount: 9n }])).toString("base64"), "base64+zstd"];
  expect(decodeStakeEntry(e, 10n).votingAmount).toBe(9n);
  e.account.data[0] = "AAAA";
  expect(() => decodeStakeEntry(e, 10n)).toThrow("compressed");
  e.account.data[0] = compress!(Buffer.alloc(1024 * 1024 + 1)).toString("base64");
  expect(() => decodeStakeEntry(e, 10n)).toThrow("compressed");
});
