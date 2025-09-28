"use client";

import { NFTRoles } from "@/components/nft-roles";
import { rolesNFT } from "@/data/nftRoleInfo";

export default function PytheniansPage() {
  console.log("Pythenians page rendered");

  return <NFTRoles nftRoles={rolesNFT} />;
}
