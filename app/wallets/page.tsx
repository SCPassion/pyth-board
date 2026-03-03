"use client";

import { useWalletInfosStore } from "@/store/store";
import { WalletSection } from "@/components/wallet-section";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function WalletsPage() {
  const { wallets } = useWalletInfosStore();

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(49,37,84,0.96)_0%,rgba(87,51,131,0.92)_52%,rgba(181,95,150,0.75)_100%)] px-6 py-7 shadow-[0_28px_70px_rgba(9,5,20,0.28)] sm:px-8">
        <div className="pointer-events-none absolute -right-8 top-4 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-24px] right-[20%] h-20 w-20 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/70">
              Wallet Management
            </p>
            <h1 className="max-w-[12ch] text-3xl font-bold leading-tight text-white sm:text-4xl">
              Connected wallets and validator positions.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
              Wallet addresses, staking accounts, APY, rewards, and validator
              rows remain unchanged. Only the presentation has been aligned with
              the updated dashboard design.
            </p>
          </div>

          <Badge
            variant="outline"
            className="w-fit rounded-xl border-white/10 bg-black/15 px-3 py-1 text-xs text-white/85"
          >
            {wallets.length} Wallets Connected
          </Badge>
        </div>
      </section>

      {wallets.length === 0 ? (
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] px-6 py-12 text-center shadow-[0_20px_50px_rgba(9,5,20,0.18)] sm:px-8 sm:py-16">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#312940] ring-1 ring-white/8 sm:h-24 sm:w-24">
            <Wallet className="h-10 w-10 text-[#b5add1] sm:h-12 sm:w-12" />
          </div>
          <h3 className="mb-3 text-2xl font-semibold text-white">
            No Wallets Connected
          </h3>
          <p className="mx-auto max-w-md text-sm text-[#b4aec8] sm:text-base">
            Connect a wallet to start tracking PYTH staking positions, validator
            exposure, and claimable rewards in this dashboard.
          </p>
        </section>
      ) : (
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-4 shadow-[0_20px_50px_rgba(9,5,20,0.18)] sm:p-5">
          <div className="mb-5 flex flex-col gap-3 border-b border-white/8 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                Wallet Portfolio
              </h2>
              <p className="mt-1 text-sm text-[#a8a1bf]">
                Review staking balances, rewards, and validator allocations for
                each connected wallet.
              </p>
            </div>
            <Badge
              variant="outline"
              className="w-fit rounded-xl border-white/8 bg-[#2f2942] px-3 py-1 text-xs text-[#b8b0d0]"
            >
              {wallets.length} Active
            </Badge>
          </div>

          <div className="space-y-5">
            {wallets.map((wallet) => (
              <WalletSection key={wallet.id} wallet={wallet} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
