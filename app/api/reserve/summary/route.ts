import { getPythReserveSummary } from "@/action/pythReserveActions";
import { cachedJson, errorJson } from "@/lib/api-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    return cachedJson(await getPythReserveSummary());
  } catch (error) {
    return errorJson(error, "Failed to fetch reserve data");
  }
}
