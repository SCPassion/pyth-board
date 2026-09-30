"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import type { WalletInfo } from "@/types/pythTypes";
import { useWalletInfosStore } from "@/store/store";
import { useAppLoading } from "@/components/app-loading-context";
import { refreshGovernanceStakingInfo } from "@/action/pythActions";
import { useState } from "react";
import toast from "react-hot-toast";

function formatPyth(amount: number) {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function WalletSection({ wallet }: { wallet: WalletInfo }) {
  const { removeWallet, setWallets } = useWalletInfosStore();
  const { isRefreshingWallets } = useAppLoading();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const info = wallet.stakingInfo?.kind === "governance" ? wallet.stakingInfo : null;
  const isLoading = isRefreshing || (isRefreshingWallets && info === null);
  const unavailableLabel = isLoading ? "Loading…" : "Unavailable";

  function saveWallets() {
    try { localStorage.setItem("wallets", JSON.stringify(useWalletInfosStore.getState().wallets)); }
    catch { /* Browser storage may be disabled. */ }
  }

  async function refresh() {
    setIsRefreshing(true);
    try {
      const result = await refreshGovernanceStakingInfo(wallet.address);
      setWallets(useWalletInfosStore.getState().wallets.map(row => row.id === wallet.id
        ? { ...row, stakingAddress: result.stakingAddress, stakingInfo: result.info } : row));
      saveWallets();
    } catch {
      toast.error("Unable to refresh governance balances. Please try again later.");
    } finally { setIsRefreshing(false); }
  }

  const metrics = [
    { label: "Active", amount: info?.activePyth, description: "PYTH currently staked for governance." },
    { label: "Warming up", amount: info?.warmingUpPyth, description: "Pending activation at the next staking epoch." },
    { label: "Unstaking", amount: info?.unstakingPyth, description: "Scheduled to unstake or in cooldown." },
  ];

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(148deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] py-0 shadow-[0_20px_55px_rgba(8,5,18,0.2)]">
      <CardContent className="space-y-7 p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl text-white">{wallet.name}</h3>
              <span className="font-data rounded-full border border-white/8 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-[#b8b0d0]">Governance</span>
            </div>
            <p className="font-data break-all text-xs text-[#a8a1bf] sm:text-sm">Solana: {wallet.address}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={isRefreshing || isRefreshingWallets} onClick={refresh}
              className="rounded-2xl border-white/10 bg-[#2f2942] text-[#d8d1ea] hover:bg-white/5">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" className="rounded-2xl border-red-500/25 bg-[#2f2942] text-red-300 hover:bg-red-500/10"
              onClick={() => { removeWallet(wallet.id); saveWallets(); toast.success(`Wallet "${wallet.name}" removed successfully!`); }}>
              <Trash2 className="h-4 w-4" />Remove Wallet
            </Button>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b8b0d0]">Total Governance Stake</p>
          <p className="font-data mt-3 text-2xl font-medium text-white sm:text-4xl" role="status" aria-busy={isLoading}>
            {info ? `${formatPyth(info.totalStakedPyth)} PYTH` : unavailableLabel}
          </p>
          <p className="mt-2 text-sm text-[#a8a1bf]">Active, warming up, and unstaking PYTH across all staking accounts.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map(metric => (
            <div key={metric.label} className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b8b0d0]">{metric.label}</p>
              <p className="font-data mt-3 text-2xl font-medium text-white">{metric.amount === undefined ? unavailableLabel : `${formatPyth(metric.amount)} PYTH`}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#a8a1bf]">{metric.description}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4 border-t border-white/8 pt-6">
          <h4 className="font-display text-xl text-white">Staking Accounts</h4>
          {info === null ? (
            <p className="text-sm text-[#a8a1bf]">{isLoading ? "Loading governance positions…" : "Governance balances could not be loaded. Use Refresh to try again."}</p>
          ) : info.stakingAccounts.length === 0 ? (
            <p className="text-sm text-[#a8a1bf]">No Pyth staking accounts found for this wallet.</p>
          ) : (
            <div className="space-y-3">
              {info.stakingAccounts.map(account => (
                <div key={account.address} className="rounded-2xl border border-white/8 bg-[#2f2942] p-4">
                  <a href={`https://solscan.io/account/${account.address}`} target="_blank" rel="noreferrer"
                    className="inline-flex max-w-full items-start gap-2 text-[#c4a6ff] hover:text-white">
                    <span className="font-data break-all text-xs sm:text-sm">{account.address}</span>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  </a>
                  <p className="mt-2 text-sm text-[#b8b0d0]">{formatPyth(account.totalStakedPyth)} PYTH in governance · Active {formatPyth(account.activePyth)} · Warming up {formatPyth(account.warmingUpPyth)} · Unstaking {formatPyth(account.unstakingPyth)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
