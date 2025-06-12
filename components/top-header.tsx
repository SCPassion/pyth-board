"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { WalletDropdown } from "@/components/wallet-dropdown";

export function TopHeader() {
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);

  return (
    <header className="h-16 border-b border-gray-800 bg-[#1a1f2e] flex items-center justify-between px-6 relative">
      <div className="flex items-center gap-6">
        <h1 className="text-white text-xl font-medium">Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Button
            variant="ghost"
            className="text-white gap-2 bg-green-500/10 hover:bg-green-500/20 cursor-pointer"
            onClick={() => setShowWalletDropdown(!showWalletDropdown)}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Wallets
            <ChevronDown className="h-4 w-4" />
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
