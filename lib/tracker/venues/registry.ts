/** Direct venues require exact program IDs and verified execution instructions.
 * Adding a venue needs a registry entry plus real fixtures, not ingestion changes. */
export type DirectVenueAdapter = {
  id: string;
  label: string;
  programIds: readonly string[];
  instructions: readonly string[];
  ownerRoles: readonly string[];
};
export const DIRECT_VENUES: readonly DirectVenueAdapter[] = [
  {
    id: "ORCA_WHIRLPOOL",
    label: "Orca Whirlpool",
    programIds: ["whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"],
    instructions: ["swap", "swap_v2"],
    ownerRoles: ["token_authority"],
  },
  {
    id: "RAYDIUM_CLMM",
    label: "Raydium CLMM",
    programIds: ["CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"],
    instructions: ["swap_v2"],
    // Named swap authority in Raydium's IDL, not the transaction fee payer.
    ownerRoles: ["payer"],
  },
];
