# PYTH governance-staker validation — 2026-09-12

Implemented and verified on development Convex `graceful-parakeet-333`. Production was inspected read-only and was not deployed. Package version remains 0.5.1.

## Definition and account layout

Count distinct stake-account owners with a positive governance voting amount in the current Pyth epoch. Qualifying positions have the `Voting` target, activation epoch at or before the collection epoch, and no unlocking start or an unlocking start strictly after the collection epoch. These are `LOCKED` and `PREUNLOCKING`, matching staking-sdk 0.3.0 `getVotingTokenAmount`.

`LOCKING`, `UNLOCKING`, `UNLOCKED`, zero amounts, and `IntegrityPool` (OIS) positions are excluded. Mixed accounts count only if they have qualifying governance stake. Multiple accounts belonging to one owner count once. This counts owners, not delegates, actual voters, or individual beneficial owners behind custodians. Vesting and custody token balances do not independently establish governance eligibility.

Verified against the installed SDK's IDL and decoder:

- Program: `pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ`.
- `PositionData` discriminator: `55c3f14f7cc04f0b`; base58 filter `FM2r3wAdZaa` at offset 0.
- Owner: 32 bytes at offset 8. Header: 40 bytes.
- Position capacity: `floor((data.length - 40) / 200)`. Each slot begins with a Borsh option byte.
- Within an occupied slot: amount at +1 (u64), activation epoch at +9 (u64), unlocking option at +17, optional unlocking epoch at +18, and target tag at +18 or +26 depending on that option. Target 0 is Voting; target 1 is IntegrityPool, followed by publisher pubkey.
- Amounts and epochs remain bigint. Every occupied slot is validated, even after eligibility is established. Owners are retained as fixed-size hex strings.

The first strict layout scan found one 64-byte account (`DbKFRXMPCemspBLKpT285McvWPmFviMq4WKuegThdbCh`) with a zero-filled 24-byte tail and no complete slots. The SDK decodes it as zero positions. The collector now accepts zero-filled unused allocation tails, but rejects nonzero incomplete tails, invalid discriminators, option tags, target tags, and malformed encoding. Synthetic tests cover this exception. Explicit `Some(0)` unlocking epochs are treated as epochs rather than the SDK helper's truthy/null shortcut; no such discrepancy occurred in the complete live comparisons.

Sources: installed `@pythnetwork/staking-sdk` 0.3.0 IDL and utilities; [Pyth program account layout](https://github.com/pyth-network/governance/blob/main/staking/programs/staking/src/state/positions.rs).

## Helius-only collection and payload choice

All Solana reads go through the server-side `PRIMARY_SOLANA_RPC_URL`. Configuration must be HTTPS on `mainnet.helius-rpc.com`; redirects and other providers are rejected. No wallet-by-wallet calls, SDK network calls, external staker APIs, new keys, or new dependencies were added.

A single discriminator-filtered `getProgramAccountsV2` scan reads complete position accounts. We do not filter by one account size or assume the first position is governance. Observed allocations range from 40 to 6,040 bytes; 226,164 accounts reserve 4,040 bytes (20 position slots). Fetching only an initial position or owner slice would omit possible qualifying positions. Reading metadata first would introduce a second scan, PDA mapping, and consistency risks around a changing active-position count.

Helius's lossless `base64+zstd` encoding eliminates most allocation padding without dropping any fields. The selected compressed page size is 5,000, with native Zstandard decompression using 4 KiB chunks and a 1 MiB decompressed-account safety limit. Native decompression is available on the verified Convex Node v24.18.0 runtime. For older Node runtimes without it, the collector uses the independently validated base64 path with 1,000-account pages, still exclusively through Helius. There is no provider fallback or fallback retry after an RPC failure.

Two additional Helius `getAccountInfo` requests read the Solana Clock sysvar before and after scanning (8-byte unix timestamp slice at offset 32). Pyth epoch is `unix_timestamp / 604800`; this is not Solana's validator epoch. Reject scans crossing a chain epoch, chain UTC day, or local UTC day. Pagination follows all continuation keys, including short and empty pages, and rejects missing or repeated cursors. Page requests have 30-second timeouts and the collection has an eight-minute deadline.

Helius reference: [getProgramAccountsV2](https://www.helius.dev/docs/api-reference/rpc/http/getprogramaccountsv2).

## Complete scan measurements

All successful scans below returned **64,326 unique owners**, **64,420 eligible accounts**, and **262,490 total position accounts**, in Pyth epoch **2958**. Every local scan compared every downloaded account's voting amount and owner with the SDK using the same data, without additional RPC requests.

| Successful scan | Page size | Requests | Response JSON bytes | Runtime | Peak RSS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Base64 correctness baseline | 1,000 | 265 | 1,302,757,654 | 86.369 s | 358.0 MiB |
| Zstandard, default decompression buffers | 10,000 | 29 | 92,230,626 | 52.540 s | 470.2 MiB |
| Zstandard, 4 KiB decompression buffers | 10,000 | 29 | 92,230,626 | 50.633 s | 396.9 MiB |
| **Selected: Zstandard, 4 KiB buffers** | **5,000** | **55** | **92,233,848** | **51.670 s** | **348.4 MiB** |
| **Deployed development collector** | **5,000** | **65** | **92,235,097** | **10.256 s** | **308.3 MiB** |

The selected local scan reduced response JSON bytes by approximately 92.9% and requests by 79.2% compared with the baseline while meeting the 384 MiB target. Ten-thousand-account compressed pages were not selected because their SDK-inclusive memory exceeded the target. Local measurements include SDK comparison and TypeScript compilation overhead; the deployed collector does neither. The local selected scan used Node 24.10.0 with `--max-old-space-size=192`. Deployed RSS is the Node process lifetime high-water mark, not an isolated allocation profile.

Byte counts measure response JSON after HTTP content decompression, including base64-encoded account payloads and clock responses; they are not raw wire-byte or billing measurements. Helius also returned HTTP gzip. The deployed scan returned 63 pages instead of the local 53 because pages may be short; all cursors were followed and account totals matched. Request counts describe each successful run, not cumulative development traffic.

An earlier attempt failed with Helius HTTP 520, and the original strict decoder rejected the padded empty account. Both stopped before persistence existed. Diagnostic response cloning was removed before final measurements.

Reproduce the complete read-only SDK comparison from the project directory:

```sh
node --max-old-space-size=192 --env-file=.env.local scripts/validate-pyth-governance-stakers.mjs
```

`GOVERNANCE_PAGE_SIZE` optionally overrides the page size for profiling. The script compiles the actual production TypeScript collector to temporary ESM files, removes those files afterward, and never writes snapshots. SDK construction is local only; its networking methods are not called.

## Persistence, schedule, and verification

- Internal collector: `pythGovernanceStakerCollection:collect`.
- Table: `pythGovernanceStakerSnapshots`, indexed by `date`.
- Stored fields: date, stakers, collectedAt, epoch, totalStakeAccounts, eligibleStakeAccounts.
- Public snapshot-only queries: `pythGovernanceStakers:latest` and paginated `history`.
- Governance cron: **15:00 UTC daily**. Existing native holder cron remains **03:00 UTC daily**.
- First development row: 2026-09-12, collected at **06:38:53.171 UTC**, 64,326 stakers.
- Immediate repeat collection logged a same-day skip. History contained one row. Two concurrent invocations of the deployed storage mutation with the real snapshot left the complete canonical document unchanged.
- The indexed read and insert execute in one Convex transaction. OCC protects concurrent first inserts; unit tests model this transaction boundary. No partial, failed, zero-staker, epoch-crossing, or midnight-crossing scan writes a row.
- Browser verification of the built app against development confirmed the initial empty state, populated count, timestamp, chart point, and independent 30D/90D/ALL filters. The UI displays the 15:00 UTC schedule, waits for two points before reporting change, marks data overdue after 36 hours, and preserves gaps. Opening the page calls only snapshot queries.

TypeScript, the production build, all 70 focused governance/holder tests, and targeted ESLint with installed Next flat configs pass. The repository's existing lint command/configuration remains broken. The full suite has 149 passing tests and retains the two pre-existing `tests/pythActions.test.ts` staking-discovery failures; those functions were not changed.

## Production status and rollout

Read-only inspection found production deployment `impartial-porpoise-429` already has holder collection and query functions. Its latest inspected holder row was 304,519 for 2026-09-12. Governance functions were absent at inspection. No production deployment, production writes, or development-to-production data copying occurred.

When production rollout is authorized:

1. Verify production `PRIMARY_SOLANA_RPC_URL` is the existing Helius mainnet endpoint without displaying the key. Check native Zstandard availability or verify the logged base64 compatibility path's resource usage if the runtime differs.
2. Deploy Convex backend/schema/cron before deploying the Next.js frontend. The new table is additive; no historical data migration is needed.
3. Run `pythGovernanceStakerCollection:collect` once for a real initial production snapshot, or wait for 15:00 UTC. Never import development snapshots or backfill days.
4. Check the logged encoding, requests, response bytes, time, and memory; verify latest/history and same-day skipping. Deploy the frontend and verify `/growth`.
5. Check the next scheduled run and overdue status. On failure, preserve the last successful snapshot and inspect Convex action logs; never substitute zero or switch RPC providers. If rollback is needed, remove the new cron and panel while retaining historical rows.
