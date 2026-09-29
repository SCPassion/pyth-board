/** Curated owner authorities excluded from the leaderboard, not the overall holder count.
 * Add an address only with a specific reason and an attribution source.
 */
import { HOLDER_POOLED_KEY } from "./holderEntities";
// Pooled custody is controlled by the frontend toggle; no permanent exclusions.
export const HOLDER_EXCLUSIONS: { owner: string; label: string; reason: string; source: string }[] = [];
export const EXCLUDED_HOLDER_OWNERS = new Set(HOLDER_EXCLUSIONS.map(row => row.owner));
// Membership determines ranking eligibility. Pooled custody classification changes also reset history to avoid misleading ranks.
export const HOLDER_EXCLUSION_KEY = `owners:${[...EXCLUDED_HOLDER_OWNERS].sort().join(",")}|pooled:${HOLDER_POOLED_KEY}`;

export function selectTopHolders(owners: Map<string, bigint>) {
  const eligible = [...owners.entries()].filter(([owner]) => !EXCLUDED_HOLDER_OWNERS.has(owner));
  return {
    eligibleHolders: eligible.length,
    topHolders: eligible
      .sort(([ownerA, a], [ownerB, b]) => a === b ? (ownerA < ownerB ? -1 : ownerA > ownerB ? 1 : 0) : a > b ? -1 : 1)
      .slice(0, 100).map(([owner, amount]) => ({ owner, amount: amount.toString() })),
  };
}
