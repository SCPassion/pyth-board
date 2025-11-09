"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Menu, X } from "lucide-react";
import { WalletDropdown } from "@/components/wallet-dropdown";

interface TopHeaderProps {
  isMobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
}

export function TopHeader({
  isMobileMenuOpen,
  onMobileMenuToggle,
}: TopHeaderProps) {
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);

  return (
    <header className="h-16 border-b border-gray-800 bg-[#1a1f2e] flex items-center justify-between px-3 sm:px-6 relative">
      <div className="flex items-center gap-2 sm:gap-6 min-w-0 flex-1">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onMobileMenuToggle}
          className="md:hidden bg-transparent text-white hover:bg-[#2a2f3e] p-2 flex-shrink-0"
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
        <h1 className="text-white text-lg sm:text-xl font-medium truncate">
          Pyth Dashboard
        </h1>
        <span className="inline-block text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700 whitespace-nowrap flex-shrink-0">
          v0.1.3
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <div className="relative">
          <Button
            variant="ghost"
            className="text-white gap-2 bg-green-500/10 hover:bg-green-500/20 cursor-pointer text-sm sm:text-base"
            onClick={() => setShowWalletDropdown(!showWalletDropdown)}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
            Wallets
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
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
