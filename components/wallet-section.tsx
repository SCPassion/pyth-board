"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2 } from "lucide-react";
import { WalletInfo } from "@/types/pythTypes";
import { useWalletInfosStore } from "@/store/store";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface WalletSectionProps {
  wallet: WalletInfo;
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export function WalletSection({ wallet }: WalletSectionProps) {
  const { removeWallet } = useWalletInfosStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [throttleQuery, setThrottleQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setThrottleQuery(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const validators = wallet.stakingInfo?.StakeForEachPublisher || [];
  const totalStaked = wallet.stakingInfo?.totalStakedPyth || 0;
  const claimableRewards = wallet.stakingInfo?.claimableRewards || 0;
  const averageApy =
    validators.reduce((sum, publisher) => sum + publisher.apy, 0) /
    (validators.length || 1);

  const filteredValidators = validators.filter((validator) => {
    if (!throttleQuery) return true;
    return validator.publisherKey
      .toLowerCase()
      .includes(throttleQuery.toLowerCase());
  });

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
      <CardContent className="p-5 sm:p-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-bold text-white">{wallet.name}</h3>
                <span className="rounded-full border border-white/8 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#b8b0d0]">
                  Wallet
                </span>
              </div>
              <p className="break-all font-mono text-xs text-[#a8a1bf] sm:text-sm">
                Solana: {wallet.address}
              </p>
              <p className="break-all font-mono text-xs text-[#a8a1bf] sm:text-sm">
                Staking: {wallet.stakingAddress}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-2xl border-red-500/25 bg-[#2f2942] text-red-300 hover:bg-red-500/10 sm:w-auto"
              onClick={() => {
                removeWallet(wallet.id);
                localStorage.setItem(
                  "wallets",
                  JSON.stringify(
                    useWalletInfosStore
                      .getState()
                      .wallets.filter((w) => w.id !== wallet.id)
                  )
                );

                toast.success(`Wallet "${wallet.name}" removed successfully!`, {
                  duration: 3000,
                  style: {
                    background: "#065f46",
                    color: "#f1f5f9",
                    border: "1px solid #047857",
                  },
                });
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Wallet
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f88a9]">
                Total Staked
              </p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-white">
                {totalStaked.toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-[#a8a1bf]">PYTH</p>
            </div>

            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f88a9]">
                Staking APY
              </p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-emerald-400">
                {averageApy.toFixed(2)}%
              </p>
            </div>

            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f88a9]">
                Claimable Rewards
              </p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-amber-300">
                {claimableRewards.toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-[#a8a1bf]">PYTH</p>
            </div>
          </div>

          <div className="space-y-4 border-t border-white/8 pt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-xl font-bold text-white">Staked Validators</h4>
                <p className="mt-1 text-sm text-[#a8a1bf]">
                  {validators.length} delegated validators for{" "}
                  {shortAddress(wallet.address)}.
                </p>
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f88a9]" />
                <Input
                  placeholder="Search validators..."
                  value={searchQuery}
                  className="w-full rounded-2xl border-white/8 bg-[#241d34] pl-10 text-white"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/6">
              <div className="hidden grid-cols-[1.6fr_0.8fr_0.6fr] gap-4 border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8f88a9] md:grid">
                <div>Validator</div>
                <div className="text-center">Your Stake</div>
                <div className="text-right">APY</div>
              </div>

              <div className="max-h-[28rem] overflow-y-auto">
                {filteredValidators.map((validator, id) => (
                  <div
                    key={`${validator.publisherKey}-${id}`}
                    className="grid gap-3 border-b border-white/6 px-4 py-4 last:border-b-0 md:grid-cols-[1.6fr_0.8fr_0.6fr] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="break-all text-sm font-medium text-white">
                        {validator.publisherKey}
                      </p>
                      <p className="mt-1 text-xs text-[#8f88a9] md:hidden">
                        Stake: {validator.stakedAmount.toLocaleString()} PYTH
                      </p>
                      <p className="mt-0.5 text-xs text-[#8f88a9] md:hidden">
                        APY: {validator.apy}%
                      </p>
                    </div>

                    <div className="hidden text-center text-base font-semibold text-white md:block">
                      {validator.stakedAmount.toLocaleString()} PYTH
                    </div>

                    <div className="hidden text-right text-base font-semibold text-emerald-400 md:block">
                      {validator.apy}%
                    </div>
                  </div>
                ))}

                {filteredValidators.length === 0 && (
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm text-[#a8a1bf]">
                      No validators match this search.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
