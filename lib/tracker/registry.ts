import type { Program } from "./types";
import { ROUTER } from "./config";
/** Discovery defaults only. Activation still requires reviewed fixtures and
 * delivery/history coverage evidence in the persisted registry. */
export const DISCOVERED_PROGRAMS: Program[] = [
  {
    programId: ROUTER,
    product: "SWAP",
    instructionNames: [
      "route",
      "shared_accounts_route",
      "exact_out_route",
      "shared_accounts_exact_out_route",
      "route_with_token_ledger",
      "shared_accounts_route_with_token_ledger",
      "route_v2",
      "shared_accounts_route_v2",
      "exact_out_route_v2",
    ],
    ownerRole: "user_transfer_authority",
    orderRole: null,
    verified: true,
  },
  {
    programId: "DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M",
    product: "RECURRING",
    instructionNames: ["initiate_flash_fill", "fulfill_flash_fill"],
    ownerRole: "user",
    orderRole: "dca",
    verified: true,
  },
  {
    programId: "j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X",
    product: "TRIGGER",
    instructionNames: ["fill_order"],
    ownerRole: "maker",
    orderRole: "order",
    verified: true,
  },
  {
    programId: "jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu",
    product: "TRIGGER",
    instructionNames: [],
    ownerRole: "maker",
    orderRole: "order",
    verified: false,
  },
];
