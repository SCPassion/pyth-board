"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  JupiterDcaCouncilOpsStatus,
  JupiterDcaOrder,
} from "@/types/pythTypes";
import { PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS } from "@/data/pythReserveAddresses";
import { Repeat, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import Image from "next/image";

/** Latest order = most recently updated (we only track the latest DCA). */
function getLatestOrder(
  status: JupiterDcaCouncilOpsStatus | null
): JupiterDcaOrder | null {
  const orders = status?.orders ?? [];
  if (orders.length === 0) return null;
  const sorted = [...orders].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return sorted[0];
}

/**
 * Vault address is NOT calculated. Jupiter API returns each DCA order with an
 * `orderKey` (on-chain vault). We link to the latest DCA vault when present;
 * otherwise to the Council Ops multisig.
 */
export function getDcaCardHref(
  status: JupiterDcaCouncilOpsStatus | null
): string {
  const latest = getLatestOrder(status);
  if (latest) {
    return `https://solscan.io/account/${latest.orderKey}`;
  }
  return `https://solscan.io/account/${PYTHIAN_COUNCIL_OPS_MULTISIG_ADDRESS}`;
}

interface JupiterDcaCardProps {
  status: JupiterDcaCouncilOpsStatus | null;
  isLoading: boolean;
}

export function JupiterDcaCard({ status, isLoading }: JupiterDcaCardProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  if (isLoading) {
    return (
      <Card className="bg-[#2a2f3e] border-gray-700">
        <CardContent className="p-4 sm:p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6">
            <div className="flex justify-center sm:justify-start">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-600 rounded-xl animate-pulse" />
            </div>
            <div className="flex flex-col md:flex-row md:items-center md:flex-1 gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-gray-600 rounded animate-pulse w-48 max-w-full" />
                <div className="h-4 bg-gray-600 rounded animate-pulse w-36" />
              </div>
              <div className="h-10 bg-gray-600 rounded animate-pulse w-32 md:w-40 flex-shrink-0" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const usingDca = status?.usingDca ?? false;
  const usdcBalance = status?.usdcBalanceVault ?? 0;
  const href = getDcaCardHref(status);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#1a1d24] rounded-lg"
    >
      <Card className="bg-[#2a2f3e] border-gray-700 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-300">
        <CardContent className="p-4 sm:p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6 min-w-0">
            {/* Icon: full-width centering on mobile, then left-aligned in row */}
            <div className="flex items-center justify-center sm:justify-start flex-shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Repeat className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-400" />
              </div>
            </div>

            {/* Content: flex column that grows and uses space */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between md:flex-1 gap-3 min-w-0">
              {/* Top block: label + badge + status */}
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-400 text-xs sm:text-sm">
                    Jupiter DCA (Council Ops)
                  </span>
                  <ExternalLink className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <Badge
                    variant="outline"
                    className={
                      usingDca
                        ? "text-emerald-400 border-emerald-600 text-xs w-fit"
                        : "text-gray-400 border-gray-600 text-xs w-fit"
                    }
                  >
                    USDC → PYTH
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {usingDca ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-white font-semibold text-sm sm:text-base">
                        Using Jupiter DCA
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-white font-semibold text-sm sm:text-base">
                        Not using DCA
                      </span>
                    </>
                  )}
                </div>
                {!usingDca && (
                  <p className="text-gray-500 text-xs">
                    No active USDC → PYTH DCA orders. Card links to Council Ops
                    multisig.
                  </p>
                )}
              </div>

              {/* Vault balance: aligns right on md+, full-width on small */}
              {usingDca && (
                <div className="flex items-center gap-2 py-2 md:py-0 md:pl-4 md:border-l md:border-gray-600 flex-shrink-0">
                  <Image
                    src="/usdc.webp"
                    alt="USDC"
                    width={24}
                    height={24}
                    className="w-6 h-6 flex-shrink-0"
                  />
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
                    <span className="text-gray-400 text-xs sm:text-sm">
                      Vault balance
                    </span>
                    <span className="text-white font-semibold text-base sm:text-lg tabular-nums">
                      {formatCurrency(usdcBalance)} USDC
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
