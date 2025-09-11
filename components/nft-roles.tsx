"use client";

import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon } from "lucide-react";
import { NFTRole } from "@/types/pythTypes";
import { NFTCard } from "@/components/nft-card";

interface NFTRolesProps {
  nftRoles: NFTRole[];
}

export function NFTRoles({ nftRoles }: NFTRolesProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          Pythenians Partnerships
        </h2>
        <Badge variant="outline" className="text-gray-400 border-gray-600">
          {nftRoles.length} Available Roles
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {nftRoles.map((role) => (
          <NFTCard key={role.id} role={role} />
        ))}
      </div>

      {nftRoles.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No NFT Roles Available
          </h3>
          <p className="text-gray-400">
            Check back later for new NFT role opportunities.
          </p>
        </div>
      )}
    </div>
  );
}
