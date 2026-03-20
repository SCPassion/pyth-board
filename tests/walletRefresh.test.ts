import { describe, it, expect, vi } from "vitest";

import type { WalletInfo } from "@/types/pythTypes";
import { refreshWalletsSequentially } from "@/lib/wallet-refresh";

const baseWallet = (id: string, totalStakedPyth: number): WalletInfo => ({
  id,
  name: `Wallet ${id}`,
  address: `address-${id}`,
  stakingAddress: `staking-${id}`,
  stakingInfo: {
    StakeForEachPublisher: [],
    totalStakedPyth,
    claimableRewards: totalStakedPyth / 10,
    generalStats: {
      totalGovernance: 1,
      totalStaked: 2,
      rewardsDistributed: 3,
    },
  },
});

describe("refreshWalletsSequentially", () => {
  it("updates wallets one at a time and emits progressive snapshots", async () => {
    const wallets = [baseWallet("1", 10), baseWallet("2", 20)];
    const callOrder: string[] = [];
    const updates: WalletInfo[][] = [];

    const refreshWallet = vi.fn(async (wallet: WalletInfo) => {
      callOrder.push(`start-${wallet.id}`);
      await Promise.resolve();
      callOrder.push(`end-${wallet.id}`);

      return {
        info: {
          ...wallet.stakingInfo!,
          totalStakedPyth: wallet.stakingInfo!.totalStakedPyth + 100,
        },
        stakingAddress: wallet.stakingAddress,
      };
    });

    const result = await refreshWalletsSequentially(
      wallets,
      refreshWallet,
      (nextWallets) => {
        updates.push(nextWallets);
      }
    );

    expect(callOrder).toEqual(["start-1", "end-1", "start-2", "end-2"]);
    expect(updates).toHaveLength(2);
    expect(updates[0][0].stakingInfo?.totalStakedPyth).toBe(110);
    expect(updates[0][1].stakingInfo?.totalStakedPyth).toBe(20);
    expect(updates[1][1].stakingInfo?.totalStakedPyth).toBe(120);
    expect(result.wallets[0].stakingInfo?.totalStakedPyth).toBe(110);
    expect(result.wallets[1].stakingInfo?.totalStakedPyth).toBe(120);
    expect(result.hadErrors).toBe(false);
    expect(result.errorMessage).toBeNull();
  });

  it("keeps the cached wallet data and reports an error when a refresh fails", async () => {
    const wallets = [baseWallet("1", 10), baseWallet("2", 20)];
    const updates: WalletInfo[][] = [];

    const refreshWallet = vi.fn(async (wallet: WalletInfo) => {
      if (wallet.id === "1") {
        throw new Error("RPC failed");
      }

      return {
        info: {
          ...wallet.stakingInfo!,
          totalStakedPyth: 999,
        },
        stakingAddress: wallet.stakingAddress,
      };
    });

    const result = await refreshWalletsSequentially(
      wallets,
      refreshWallet,
      (nextWallets) => {
        updates.push(nextWallets);
      }
    );

    expect(result.wallets[0].stakingInfo?.totalStakedPyth).toBe(10);
    expect(result.wallets[1].stakingInfo?.totalStakedPyth).toBe(999);
    expect(updates.at(-1)?.[0].stakingInfo?.totalStakedPyth).toBe(10);
    expect(updates.at(-1)?.[1].stakingInfo?.totalStakedPyth).toBe(999);
    expect(result.hadErrors).toBe(true);
    expect(result.errorMessage).toBe(
      "Some wallet balances could not be refreshed. Try again later."
    );
  });
});
