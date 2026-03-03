"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { WalletDropdown } from "@/components/wallet-dropdown";
import { PriceTicker } from "@/components/price-ticker";

interface TopHeaderProps {
  isMobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
}

export function TopHeader({
  isMobileMenuOpen,
  onMobileMenuToggle,
}: TopHeaderProps) {
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const pathname = usePathname();

  const pageTitle =
    pathname === "/"
      ? "Dashboard"
      : pathname.startsWith("/wallets")
        ? "Wallets"
        : pathname.startsWith("/pythenians")
          ? "Pythenians"
          : pathname.startsWith("/reserve")
            ? "Reserve"
            : "Pyth Dashboard";

  return (
    <header className="flex h-20 items-center justify-between gap-3 border-b border-white/6 bg-[#241b35] px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
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

        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-white sm:text-xl">
            {pageTitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center md:flex">
          <PriceTicker />
        </div>

        <div className="relative">
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
          />
        </div>
      </div>
    </header>
  );
}
