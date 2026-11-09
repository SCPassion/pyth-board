import { getJupiterDcaCouncilOps } from "@/action/jupiterDcaActions";
import { cachedJson, errorJson } from "@/lib/api-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    return cachedJson(await getJupiterDcaCouncilOps());
  } catch (error) {
    return errorJson(error, "Failed to fetch Jupiter DCA status");
  }
}
