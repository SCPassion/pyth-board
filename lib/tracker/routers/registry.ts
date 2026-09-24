import { DIRECT_VENUES } from "../venues/registry";
import { RFQ } from "./settlement";
import { ROUTER } from "../config";
import type { Instruction } from "../types";
/** Add routers here, not in ingestion, queries or UI. Provider aliases are exact,
 * version-specific Parsed Events labels; never substring-match arbitrary names.
 * Add a mainnet fixture before treating a new mapping as production verified. */
export type RouterAdapter = {
  id: string;
  label: string;
  programIds: readonly string[];
  providerNames: readonly string[];
  ownerRoles: readonly string[];
  /** Keep decoding evidence, but hold this router's endpoint trades for review. */
  reviewOnly?: boolean;
  /** Known setup instructions, only skipped when their entire subtree is infrastructure. */
  setupInstructions?: readonly string[];
};
export const ROUTER_ADAPTERS: readonly RouterAdapter[] = [
  {
    id: "JUPITER_RFQ",
    label: "Jupiter RFQ",
    programIds: [RFQ],
    providerNames: [],
    ownerRoles: [],
  },
  {
    id: "RAYDIUM_ROUTER",
    label: "Raydium Router",
    programIds: ["routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS"],
    providerNames: [],
    ownerRoles: [], // The outer instruction has no verified named owner role.
  },
  {
    id: "WHIRLPOOL_WRAPPER",
    label: "Whirlpool wrapper",
    programIds: ["BoobsBSMpFRBA91sNwKLYShRRQPH5GjoCH4NhLUt4yRo"],
    providerNames: [],
    ownerRoles: [],
  },
  {
    id: "JUPITER",
    label: "Jupiter",
    programIds: [ROUTER],
    providerNames: [],
    ownerRoles: ["user_transfer_authority"],
  },
  {
    id: "TITAN",
    label: "Titan",
    programIds: ["T1TANpTeScyeqVzzgNViGDNrkQ6qHz9KrSBS4aNXvGT"],
    providerNames: ["titan_swap"],
    ownerRoles: ["user", "user_transfer_authority"],
  },
  {
    id: "DFLOW",
    reviewOnly: true,
    setupInstructions: ["wrap_sol"],
    label: "DFlow",
    programIds: ["DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH"],
    providerNames: ["dflow", "dflow_aggregator", "dflow_aggregator_v4"],
    ownerRoles: ["user", "user_transfer_authority"],
  },
  {
    id: "OKX",
    setupInstructions: ["create_token_account"],
    label: "OKX DEX",
    programIds: [
      "6m2CDdhRgxpH4WjvdzxAYbGxwdGUz5MziiL5jek2kBma",
      "proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u",
    ],
    providerNames: ["okx_dex", "okx_router"],
    ownerRoles: ["user", "user_transfer_authority"],
  },
];
export function routerFor(ix: Instruction, adapters = ROUTER_ADAPTERS) {
  return adapters.find(
    (a) =>
      a.programIds.includes(ix.programId) ||
      (!!ix.programName && a.providerNames.includes(ix.programName)),
  );
}
export function routerLabel(id?: string) {
  if (id === "STATE_EXCHANGE") return "On-chain swap";
  return (
    [...ROUTER_ADAPTERS, ...DIRECT_VENUES].find((a) => a.id === id)?.label ??
    id ??
    "Jupiter"
  );
}
