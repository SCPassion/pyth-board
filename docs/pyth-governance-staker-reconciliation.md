# PYTH governance staker reconciliation — 12 September 2026

## Result

The supplied Dune export contains 120,696 unique signers. The fresh Helius scan contains 64,326 unique voting-eligible stake owners, reproducing the earlier count. Most addresses present only in Dune have positions that no longer qualify for governance voting.

| Group | Addresses |
| --- | ---: |
| In both lists | 62,572 |
| Only in Dune | 58,124 |
| Only in current eligible owners | 1,754 |

The arithmetic reconciles exactly: 120,696 − 58,124 + 1,754 = 64,326.

## Addresses only in Dune

| Observed current condition | Addresses |
| --- | ---: |
| Positive governance positions past their unlocking start; no eligible governance amount | 57,871 |
| Positive governance positions still locking; no eligible governance amount | 3 |
| Positive OIS positions only | 68 |
| Position accounts exist but contain no positive positions | 164 |
| No position account found with the signer as its current owner | 18 |
| Total | 58,124 |

The 57,871 group combines UNLOCKING and UNLOCKED; this investigation retained their combined amount rather than the exact unlocking epoch. Of these, 51,744 have a current exiting-position amount within 1 PYTH of their Dune balance. Retained position amounts do not prove tokens remain in custody; no custody reads were made.

## Addresses only in our count

697 have less than 1 PYTH of eligible governance stake, below Dune's threshold. The other 1,057 have at least 1 PYTH and require historical transaction/ownership reconciliation to explain their omission from the export. Do not attribute these automatically to any one SQL defect, ownership changes, or timing.

## Method and evidence

Source CSV: /Users/scp/Downloads/PYTH_Governance_Staking_Leaderboard.csv

SHA-256: 85078c49e0b7ebbc6ecd3f3ea3fc88b0780fe372f5cf8846ca023a0c67a030a8

The CSV has no duplicate signers. Its minimum amount is 1 PYTH and its sum is 1,624,709,522 PYTH, matching its declared total. Dune query: https://dune.com/queries/4231021/8026266. The export does not establish an exact chain slot or query execution timestamp.

Scan window: 2026-09-12T09:09:12.044000+00:00 to 2026-09-12T09:10:03.942000+00:00; Pyth epoch 2958.

All blockchain reads used PRIMARY_SOLANA_RPC_URL on Helius. The existing collector scanned 262,490 complete position accounts across 53 pages and 55 RPC requests, reading 92,233,876 response JSON bytes in 51.898 seconds. 64,420 accounts qualified, deduplicated to 64,326 owners. Every downloaded account's owner and voting amount matched the installed SDK. Pagination completed and the chain epoch/day guards passed.

The investigation aggregated position amounts by current owner and compared those owner addresses with Dune signer addresses. It inspected every occupied slot, using the existing verified layout. Voting eligibility was SDK-validated; the additional classification uses activation and unlocking epochs from those slots.

The retained investigation data increased memory use beyond the daily collector: the first attempt exhausted a 256 MiB heap; the successful retry used compact hex owner keys and a 512 MiB heap. Its final process peak RSS was 872.2 MiB, including conversion and serialization of the full owner dataset. This is not the daily collector's memory benchmark. No production or development snapshot writes, deployments, holder changes, or collector code changes were made.

## Interpretation and limits

The main numerical difference is now directly observed as position eligibility, rather than merely hypothesized. For current voting-eligible owners, the fresh scan is better supported than treating all Dune rows as currently eligible stakers. The lists were not captured at an identical Solana slot. This comparison does not establish the historical cause of every difference, independently prove provider completeness, or demonstrate how many rows were affected by the previously identified SQL source-combination issue.

The 18 signers with no matching current owner must not be described as missing RPC accounts: signer and owner can differ. The export alone cannot resolve that identity relationship.
