"use client";

import { NFTRoles } from "@/components/nft-roles";
import { useEffect, useState } from "react";

export default function PytheniansPage() {
  const [isClient, setIsClient] = useState(false);
  const [rolesData, setRolesData] = useState<any[]>([]);

  useEffect(() => {
    setIsClient(true);
    // Force fresh data import with cache busting
    import("@/data/nftRoleInfo").then((module) => {
      setRolesData(module.rolesNFT);
    });
  }, []);

  // Prevent hydration mismatch by only rendering on client
  if (!isClient) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Pythenians Partnerships
          </h2>
          <div className="flex items-center gap-3">
            <div className="text-gray-400 border-gray-600 text-sm px-2 py-0.5 rounded-md border">
              Loading...
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#2a2f3e] border-gray-600 rounded-lg p-4 animate-pulse"
            >
              <div className="h-16 w-16 bg-gray-700 rounded-lg mb-3"></div>
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-700 rounded mb-4"></div>
              <div className="flex gap-2">
                <div className="h-8 bg-gray-700 rounded flex-1"></div>
                <div className="h-8 bg-gray-700 rounded flex-1"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <NFTRoles nftRoles={rolesData} />;
}
