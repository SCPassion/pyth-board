import { getSwapTransactionsPage } from "@/action/swapTransactionsActions";
import { cachedJson, errorJson } from "@/lib/api-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = clampInt(searchParams.get("page"), 1, 1, 50);
  const pageSize = clampInt(searchParams.get("pageSize"), 10, 1, 50);

  try {
    // Swap history changes rarely; cache it longer than balances.
    return cachedJson(await getSwapTransactionsPage(page, pageSize), {
      sMaxAge: 300,
      staleWhileRevalidate: 3600,
    });
  } catch (error) {
    return errorJson(error, "Failed to fetch swap transactions");
  }
}
