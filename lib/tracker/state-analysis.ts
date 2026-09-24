import { confirmIntermediateRoute } from "./semantics/intermediate-route";
import { confirmIntermediateCycle } from "./semantics/intermediate-cycle";
import { confirmPoolExchange } from "./semantics/pool-exchange";
import { analyzeDcaPositions } from "./semantics/dca";
import { analyzeNativeSol } from "./native-sol";
import { record } from "./helius-format";
import { normalizeTransaction } from "./normalize";
import { analyzeEconomicDomains } from "./economic-domains";
import { projectPythMovements } from "./movements";
export function analyzeRawEvidence(
  payload: unknown,
  signature: string,
  success: boolean,
) {
  const envelope = record(payload);
  const normalized = normalizeTransaction(
    envelope.signature === signature ? envelope.rawTransaction : null,
    signature,
    success,
  );
  const positions = analyzeDcaPositions(envelope.rawTransaction, normalized);
  const economic = analyzeEconomicDomains(normalized, positions);
  const confirmedTrades = confirmPoolExchange(
    envelope.rawTransaction,
    normalized,
    economic,
  );
  const cycles = confirmIntermediateCycle(
    envelope.rawTransaction,
    normalized,
    economic,
  );
  const exclusions = cycles.length
    ? cycles
    : confirmIntermediateRoute(envelope.rawTransaction, normalized);
  return {
    exclusions,
    confirmedTrades,
    normalized,
    nativeSol: analyzeNativeSol(normalized),
    positions,
    economic,
    movementAccounting: projectPythMovements(normalized),
  };
}
export type StateAnalysis = ReturnType<typeof analyzeRawEvidence>;
