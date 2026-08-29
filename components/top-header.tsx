"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Download, Github, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { WalletDropdown } from "@/components/wallet-dropdown";
import { PriceTicker } from "@/components/price-ticker";
import { usePwaInstall } from "@/components/pwa-install-context";
import { useAppLoading } from "@/components/app-loading-context";
import packageJson from "@/package.json";

interface TopHeaderProps {
  isMobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
}

export function TopHeader({
  isMobileMenuOpen,
  onMobileMenuToggle,
}: TopHeaderProps) {
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showRefreshComplete, setShowRefreshComplete] = useState(false);
  const [isRefreshCompleteFading, setIsRefreshCompleteFading] = useState(false);
  const { canInstall, installApp } = usePwaInstall();
  const { isRefreshingWallets, lastWalletRefreshAt, walletRefreshError } =
    useAppLoading();
  const pathname = usePathname();
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const wasRefreshingRef = useRef(false);

  const pageTitle =
    pathname === "/"
      ? "Dashboard"
      : pathname.startsWith("/wallets")
        ? "Wallets"
        : pathname.startsWith("/pythenians")
          ? "Pythenians"
          : pathname.startsWith("/reserve")
            ? "DAO Reserve"
            : pathname.startsWith("/revenue")
              ? "Protocol Revenue"
            : "Pyth Dashboard";

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (isRefreshingWallets) {
      wasRefreshingRef.current = true;
      setShowRefreshComplete(false);
      setIsRefreshCompleteFading(false);
      return;
    }

    if (walletRefreshError) {
      setShowRefreshComplete(false);
      setIsRefreshCompleteFading(false);
      wasRefreshingRef.current = false;
      return;
    }

    if (wasRefreshingRef.current && lastWalletRefreshAt) {
      setShowRefreshComplete(true);
      setIsRefreshCompleteFading(false);
      wasRefreshingRef.current = false;

      fadeTimer = setTimeout(() => {
        setIsRefreshCompleteFading(true);
      }, 1200);

      hideTimer = setTimeout(() => {
        setShowRefreshComplete(false);
        setIsRefreshCompleteFading(false);
      }, 1800);
    }

    return () => {
      if (fadeTimer) clearTimeout(fadeTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isRefreshingWallets, lastWalletRefreshAt, walletRefreshError]);

  const walletRefreshStatus =
    walletRefreshError
      ? {
          label: walletRefreshError,
          className:
            "border-amber-400/20 bg-amber-300/10 text-amber-100",
        }
      : isRefreshingWallets
        ? {
            label: "Refreshing wallet balances and rewards...",
            className:
              "border-cyan-400/30 bg-cyan-300/12 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.25)] animate-pulse",
          }
        : showRefreshComplete
          ? {
              label: "Wallet balances refreshed",
              className:
                `border-emerald-400/20 bg-emerald-300/10 text-emerald-50 transition-all duration-500 ${
                  isRefreshCompleteFading
                    ? "translate-y-[-4px] opacity-0"
                    : "translate-y-0 opacity-100"
                }`,
            }
          : null;

  return (
    <header className="flex min-h-20 items-center justify-between gap-3 border-b border-white/6 bg-[#241b35] px-3 py-3 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMobileMenuToggle}
          className="md:hidden rounded-full bg-transparent p-2 text-white hover:bg-white/5"
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <p className="font-display truncate text-lg text-white sm:text-xl">
            {pageTitle}
          </p>
          <span className="font-data hidden rounded-xl border border-white/8 bg-[#2f2942] px-2.5 py-1 text-[11px] tracking-[0.12em] text-[#b8b0d0] sm:inline-flex">
            v{packageJson.version}
          </span>
          <div className="hidden min-w-0 items-center gap-1.5 sm:flex lg:gap-2">
            {canInstall ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={installApp}
                className="h-9 rounded-full border border-white/10 bg-[#2b243d] px-2.5 text-sm font-medium text-[#edf1ff] hover:bg-[#342c49] hover:text-white lg:px-3"
                title="Install App"
              >
                <Download className="h-4 w-4 text-[#cfd7ee]" />
                <span className="hidden md:inline">Install</span>
              </Button>
            ) : null}

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-9 rounded-full border border-white/10 bg-[#2b243d] px-2.5 text-sm font-medium text-[#edf1ff] hover:bg-[#342c49] hover:text-white lg:px-3"
            >
              <Link
                href="https://github.com/SCPassion/pyth-board"
                target="_blank"
                rel="noreferrer"
                title="Project Repo"
              >
                <Github className="h-4 w-4 text-[#cfd7ee]" />
                <span className="hidden lg:inline 2xl:hidden">Repo</span>
                <span className="hidden 2xl:inline">Project Repo</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden h-9 rounded-full border border-white/10 bg-[#2b243d] px-2.5 text-sm font-medium text-[#edf1ff] hover:bg-[#342c49] hover:text-white xl:inline-flex lg:px-3"
            >
              <Link
                href="https://www.scptech.xyz/"
                target="_blank"
                rel="noreferrer"
                title="Built by SCPTech"
              >
                <Image
                  src="/SCP1.jpg"
                  alt="SCPTech logo"
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] rounded-full object-cover"
                />
                <span className="hidden 2xl:inline">Built by SCPTech</span>
              </Link>
            </Button>
            {walletRefreshStatus ? (
              <div
                className={`hidden max-w-[24rem] truncate rounded-full border px-3 py-1 text-[11px] font-medium 2xl:inline-flex ${walletRefreshStatus.className}`}
                title={walletRefreshStatus.label}
              >
                {walletRefreshStatus.label}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden items-center 2xl:flex">
          <PriceTicker />
        </div>

        <div ref={walletMenuRef} className="relative">
          <Button
            variant="ghost"
            className="h-10 rounded-2xl border border-white/8 bg-[#2f2942] px-3 text-sm text-white hover:bg-[#3a3350]"
            onClick={() => setShowWalletDropdown(!showWalletDropdown)}
          >
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            Wallets
            <ChevronDown className="h-4 w-4 shrink-0 text-[#9f97bb]" />
          </Button>

          <WalletDropdown
            isOpen={showWalletDropdown}
            onClose={() => setShowWalletDropdown(false)}
            containerRef={walletMenuRef}
          />
        </div>
      </div>
    </header>
  );
}
