"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { WalletInfo } from "@/types/pythTypes";
import { useWalletInfosStore } from "@/store/store";

interface WalletSectionProps {
  wallet: WalletInfo;
}

export function WalletSection({ wallet }: WalletSectionProps) {
  const { removeWallet } = useWalletInfosStore();
  const sumApy = wallet.stakingInfo?.StakeForEachPublisher.reduce(
    (sum, publisher) => sum + publisher.apy,
    0
  ) as number;
  const averageApy =
    sumApy / (wallet.stakingInfo?.StakeForEachPublisher.length || 1);

  return (
    <div className="space-y-6">
      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">
                {" "}
                Wallet Name: {wallet.name}
              </h3>
              <p className="text-gray-400 font-mono text-sm">
                Solana Address: {wallet.address}
              </p>
              <p className="text-gray-400 font-mono text-sm">
                Staking Account: {wallet.stakingAddress}
              </p>
            </div>
            <div className="text-right">
              <Button
                variant="outline"
                size="sm"
                className="border-red-500 text-red-400 hover:bg-red-500/10 mb-2 cursor-pointer"
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
                  // Handle wallet removal logic here
                  console.log(`Removing wallet: ${wallet.id}`);
                }}
              >
                Remove Wallet
              </Button>
              <p className="text-2xl font-bold text-white">
                {wallet.stakingInfo?.totalStakedPyth.toFixed(2)} PYTH
              </p>
              <p className="text-gray-400 text-sm">Total Staked</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-gray-400 text-sm">Staking APY</p>
              <p className="text-2xl font-bold text-green-400">
                {averageApy.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Rewards Earned</p>
              <p className="text-2xl font-bold text-white">
                {wallet.stakingInfo?.claimableRewards.toFixed(2)} PYTH
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">
                Number of Delegated Validators
              </p>
              <p className="text-2xl font-bold text-white">
                {wallet.stakingInfo?.StakeForEachPublisher.length || 0}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xl font-bold text-white">
                Staked Validators
              </h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search validators..."
                  className="pl-10 bg-[#1a1f2e] border-gray-600 text-white w-64"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 text-gray-400 text-sm font-medium pb-2 border-b border-gray-700 text-center">
                <div>Validator's public key</div>
                <div>Your Stake</div>
                <div>APY</div>
                <div></div>
              </div>

              {wallet.stakingInfo?.StakeForEachPublisher.map(
                (validator, id) => (
                  <div
                    key={id}
                    className="grid grid-cols-3 gap-4 items-center py-3 hover:bg-gray-800/50 rounded-lg px-2 text-center"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <span className="text-blue-400 text-sm font-bold">
                          V
                        </span>
                      </div>
                      <span className="text-white">
                        {validator.publisherKey}
                      </span>
                    </div>

                    <div className="text-white font-medium">
                      {validator.stakedAmount.toLocaleString()} PYTH
                    </div>
                    <div className="text-green-400 font-medium">
                      {validator.apy}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
