import { describe, expect, it } from "vitest";
import { parseStoredWallets, getGovernancePortfolioTotal } from "@/lib/wallet-storage";
import { refreshWalletsSequentially } from "@/lib/wallet-refresh";

const legacyWallet = { id: "main", name: "Main Wallet", address: "saved-solana-address", stakingAddress: "saved-stake-account",
  stakingInfo: { totalStakedPyth: 500, claimableRewards: 12, StakeForEachPublisher: [{ apy: 8 }] } };
const governanceInfo = { kind: "governance", totalStakedPyth: 190, activePyth: 100, warmingUpPyth: 20, unstakingPyth: 70, stakingAccounts: [] };

describe("saved wallet governance migration", () => {
  it("preserves legacy wallet identity and discards OIS balances", () => {
    const [wallet] = parseStoredWallets(JSON.stringify([legacyWallet]));
    expect(wallet).toEqual({ ...legacyWallet, stakingInfo: null });
    expect(getGovernancePortfolioTotal([wallet])).toBeNull();
  });
  it("does not restore legacy OIS balances when refreshing fails", async () => {
    const wallets = parseStoredWallets(JSON.stringify([legacyWallet]));
    const result = await refreshWalletsSequentially(wallets, async () => { throw Error("RPC unavailable"); }, () => {});
    expect(result.hadErrors).toBe(true);
    expect(result.wallets[0].stakingInfo).toBeNull();
    expect(getGovernancePortfolioTotal(result.wallets)).toBeNull();
  });
  it("keeps valid governance caches during a later refresh", () => {
    const wallets = parseStoredWallets(JSON.stringify([{ ...legacyWallet, stakingInfo: governanceInfo }]));
    expect(wallets[0].stakingInfo).toEqual(governanceInfo);
    expect(getGovernancePortfolioTotal(wallets)).toBe(190);
  });
  it.each([null, "bad json", "{}", "[null,1,{}]"])("handles corrupted storage %s", value => {
    expect(parseStoredWallets(value)).toEqual([]);
  });
  it("discards malformed governance caches instead of displaying invalid balances", () => {
    const wallets = parseStoredWallets(JSON.stringify([{ ...legacyWallet, stakingInfo: { ...governanceInfo, activePyth: -1 } }]));
    expect(wallets[0].stakingInfo).toBeNull();
  });
  it("returns unavailable instead of a partial portfolio total", () => {
    const wallets = parseStoredWallets(JSON.stringify([legacyWallet, { ...legacyWallet, id: "second", stakingInfo: governanceInfo }]));
    expect(getGovernancePortfolioTotal(wallets)).toBeNull();
  });
  it("accepts genuine zero stake", () => {
    const wallets = parseStoredWallets(JSON.stringify([{ ...legacyWallet, stakingInfo: { ...governanceInfo, totalStakedPyth: 0, activePyth: 0, warmingUpPyth: 0, unstakingPyth: 0 } }]));
    expect(getGovernancePortfolioTotal(wallets)).toBe(0);
    expect(getGovernancePortfolioTotal([])).toBe(0);
  });
});
