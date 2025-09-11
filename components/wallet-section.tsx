"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { WalletInfo } from "@/types/pythTypes";
import { useWalletInfosStore } from "@/store/store";
import { useEffect, useState } from "react";

interface WalletSectionProps {
  wallet: WalletInfo;
}

export function WalletSection({ wallet }: WalletSectionProps) {
  const { removeWallet } = useWalletInfosStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [throttleQuery, setThrottleQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setThrottleQuery(searchQuery);
    }, 300); // Adjust the delay as needed

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const sumApy = wallet.stakingInfo?.StakeForEachPublisher.reduce(
    (sum, publisher) => sum + publisher.apy,
    0
  ) as number;
  const averageApy =
    sumApy / (wallet.stakingInfo?.StakeForEachPublisher.length || 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-4 sm:space-y-0">
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Wallet Name: {wallet.name}
              </h3>
              <p className="text-gray-400 font-mono text-xs sm:text-sm break-all">
                Solana Address: {wallet.address}
              </p>
              <p className="text-gray-400 font-mono text-xs sm:text-sm break-all">
                Staking Account: {wallet.stakingAddress}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <Button
                variant="outline"
                size="sm"
                className="border-red-500 text-red-400 hover:bg-red-500/10 mb-2 cursor-pointer w-full sm:w-auto"
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
              <p className="text-xl sm:text-2xl font-bold text-white">
                {wallet.stakingInfo?.totalStakedPyth.toFixed(2)} PYTH
              </p>
              <p className="text-gray-400 text-xs sm:text-sm">Total Staked</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Staking APY</p>
              <p className="text-xl sm:text-2xl font-bold text-green-400">
                {averageApy.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">Rewards Earned</p>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {wallet.stakingInfo?.claimableRewards.toFixed(2)} PYTH
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">
                Number of Delegated Validators
              </p>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {wallet.stakingInfo?.StakeForEachPublisher.length || 0}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <h4 className="text-lg sm:text-xl font-bold text-white">
                Staked Validators
              </h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search validators..."
                  value={searchQuery}
                  className="pl-10 bg-[#1a1f2e] border-gray-600 text-white w-full sm:w-64"
                  onChange={(e) => {
                    // Handle search logic here
                    setSearchQuery(e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-3 gap-4 text-gray-400 text-sm font-medium pb-2 border-b border-gray-700 text-center">
                <div>Validator's public key</div>
                <div>Your Stake</div>
                <div>APY</div>
              </div>

              {wallet.stakingInfo?.StakeForEachPublisher.map(
                (validator, id) => {
                  if (
                    throttleQuery &&
                    !validator.publisherKey
                      .toLowerCase()
                      .includes(throttleQuery.toLowerCase())
                  ) {
                    return null; // Skip this validator if it doesn't match the search query
                  }
                  return (
                    <div
                      key={id}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center py-3 hover:bg-gray-800/50 rounded-lg px-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <span className="text-blue-400 text-xs sm:text-sm font-bold">
                            V
                          </span>
                        </div>
                        <span className="text-white text-xs sm:text-sm break-all">
                          {validator.publisherKey}
                        </span>
                      </div>

                      <div className="text-white font-medium text-sm sm:text-base">
                        <span className="sm:hidden text-gray-400 text-xs">
                          Stake:{" "}
                        </span>
                        {validator.stakedAmount.toLocaleString()} PYTH
                      </div>
                      <div className="text-green-400 font-medium text-sm sm:text-base">
                        <span className="sm:hidden text-gray-400 text-xs">
                          APY:{" "}
                        </span>
                        {validator.apy}%
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
