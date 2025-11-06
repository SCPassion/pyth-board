"use client";

import { NFTRoles } from "@/components/nft-roles";
import { rolesNFT } from "@/data/nftRoleInfo";

export default function PytheniansPage() {
  return <NFTRoles nftRoles={rolesNFT} />;
}
