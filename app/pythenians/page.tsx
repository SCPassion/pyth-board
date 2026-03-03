"use client";

import dynamic from "next/dynamic";
import { NFTRoles } from "@/components/nft-roles";
import { sortedRolesNFT } from "@/data/nftRoleInfo";

const PytheniansContent = () => {
  return <NFTRoles nftRoles={sortedRolesNFT} />;
};

export default dynamic(() => Promise.resolve(PytheniansContent), {
  ssr: false,
});
