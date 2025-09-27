"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { NFTRoles } from "@/components/nft-roles";
import { rolesNFT } from "@/data/nftRoleInfo";

export default function PytheniansPage() {
  console.log("Pythenians page rendered");

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = useCallback(() => {
    console.log("Mobile menu toggled");
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuToggle={toggleMobileMenu}
      />

      <div className="flex-1 flex flex-col md:ml-0">
        <TopHeader
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuToggle={toggleMobileMenu}
        />

        <main className="flex-1 overflow-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          <NFTRoles nftRoles={rolesNFT} />
        </main>
      </div>
    </div>
  );
}
