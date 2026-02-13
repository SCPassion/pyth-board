"use server";

import type {
  JupiterDcaOrder,
  JupiterDcaCouncilOpsStatus,
} from "@/types/pythTypes";
import { PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS } from "@/data/pythReserveAddresses";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

const JUPITER_RECURRING_API =
  "https://lite-api.jup.ag/recurring/v1/getRecurringOrders";

/** Raw response shape from Jupiter getRecurringOrders (time-based active orders) */
type JupiterRecurringResponse = {
  user: string;
  orderStatus: string;
  time?: Array<{
    userPubkey: string;
    orderKey: string;
    inputMint: string;
    outputMint: string;
    inDeposited: number;
    inWithdrawn: number;
    rawInDeposited: string;
    rawInWithdrawn: string;
    cycleFrequency: string;
    outWithdrawn: number;
    inAmountPerCycle: number;
    minOutAmount: number;
    maxOutAmount: number;
    inUsed: number;
    outReceived: number;
    rawOutWithdrawn: string;
    rawInAmountPerCycle: string;
    rawMinOutAmount: string;
    rawMaxOutAmount: string;
    rawInUsed: string;
    rawOutReceived: string;
    openTx: string;
    closeTx: string;
    userClosed: boolean;
    createdAt: string;
    updatedAt: string;
    trades?: unknown[];
  }>;
};

/**
 * Fetches Jupiter DCA status for the Pythian Council Ops address.
 * Returns whether it is using Jupiter DCA to swap USDC for PYTH and the USDC balance in the DCA vault(s).
 */
export async function getJupiterDcaCouncilOps(): Promise<JupiterDcaCouncilOpsStatus> {
  const user = PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS;
  const url = new URL(JUPITER_RECURRING_API);
  url.searchParams.set("user", user);
  url.searchParams.set("orderStatus", "active");
  url.searchParams.set("recurringType", "time");
  url.searchParams.set("includeFailedTx", "false");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "PythBoard/1.0" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn(`Jupiter DCA API error: ${res.status} ${res.statusText}`);
      return { usingDca: false, usdcBalanceVault: 0, orders: [] };
    }

    const data = (await res.json()) as JupiterRecurringResponse;
    const timeOrders = data.time ?? [];

    const usdcToPythOrders: JupiterDcaOrder[] = timeOrders
      .filter(
        (o) =>
          o.inputMint === USDC_MINT &&
          o.outputMint === PYTH_MINT
      )
      .map((o) => ({
        orderKey: o.orderKey,
        userPubkey: o.userPubkey,
        inputMint: o.inputMint,
        outputMint: o.outputMint,
        inDeposited: o.inDeposited,
        inWithdrawn: o.inWithdrawn,
        inUsed: o.inUsed,
        outWithdrawn: o.outWithdrawn,
        inAmountPerCycle: o.inAmountPerCycle,
        cycleFrequency: o.cycleFrequency,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }));

    const usdcBalanceVault = usdcToPythOrders.reduce(
      (sum, o) => sum + Math.max(0, o.inDeposited - o.inUsed),
      0
    );

    return {
      usingDca: usdcToPythOrders.length > 0,
      usdcBalanceVault,
      orders: usdcToPythOrders,
    };
  } catch (error) {
    console.error("Jupiter DCA fetch error:", error);
    return { usingDca: false, usdcBalanceVault: 0, orders: [] };
  }
}
