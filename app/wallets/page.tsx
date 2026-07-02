"use client";

import { useWalletInfosStore } from "@/store/store";
import { WalletSection } from "@/components/wallet-section";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageMasthead } from "@/components/page-masthead";
import { SectionRule } from "@/components/section-rule";

export default function WalletsPage() {
  const { wallets } = useWalletInfosStore();

  return (
    <div className="w-full min-w-0 space-y-16 sm:space-y-20">
      <PageMasthead
        eyebrow="Wallet Management"
        title="Connected wallets and validator positions."
        description="Wallet addresses, staking accounts, APY, rewards, and validator rows for every wallet you've connected to this dashboard."
        right={
          <Badge
            variant="outline"
            className="font-data w-fit rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/85"
          >
            {wallets.length} Wallets Connected
          </Badge>
        }
      />

      {wallets.length === 0 ? (
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] px-6 py-14 text-center shadow-[0_20px_50px_rgba(9,5,20,0.18)] sm:px-8 sm:py-20">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#312940] ring-1 ring-white/8 sm:h-24 sm:w-24">
            <Wallet className="h-10 w-10 text-[#b5add1] sm:h-12 sm:w-12" />
          </div>
          <h3 className="font-display mb-4 text-2xl text-white">
            No Wallets Connected
          </h3>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-[#b4aec8] sm:text-base">
            Connect a wallet to start tracking PYTH staking positions, validator
            exposure, and claimable rewards in this dashboard.
          </p>
        </section>
      ) : (
        <section className="space-y-7 pb-2">
          <SectionRule
            index="01"
            title="Wallet Portfolio"
            description="Review staking balances, rewards, and validator allocations for each connected wallet."
            right={
              <Badge
                variant="outline"
                className="font-data w-fit rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-xs text-[#b8b0d0]"
              >
                {wallets.length} Active
              </Badge>
            }
          />

          <div className="space-y-8">
            {wallets.map((wallet) => (
              <WalletSection key={wallet.id} wallet={wallet} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
