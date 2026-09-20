# PYTH holder RPC validation — 2026-09-10

Status: stopped at the specification's RPC feasibility gate. No schema, cron, UI, or deployment changes have been made.

## Existing configuration

`action/pythActions.ts` reads `PRIMARY_SOLANA_RPC_URL`; the local configured host is Helius. Existing Convex reserve and buyback collectors instead contain hardcoded endpoint lists. The deployed Convex environment has not been verified (the environment inspection failed with restricted network access). No credentials are included in this report.

## Live request

Ran `node --env-file=.env.local scripts/validate-pyth-holders.mjs` using the existing endpoint. Standard `getProgramAccounts`, confirmed commitment, SPL Token Program, PYTH mint filter at offset 0, size 165, base64, dataSlice offset 32 / length 40.

- HTTP 200
- 9,485 ms to receive the response body
- 272,876,497 bytes of response JSON (260.24 MiB)
- 961,019 token accounts
- Every returned data slice passed canonical base64 and 40-byte length validation
- 304,589 positive-balance token accounts
- **304,400 unique positive-balance owners**
- Local parse/count: 1,651 ms; peak process RSS 1,946 MiB
- Count validation finished at 2026-09-10T18:14:56Z (not a persisted snapshot)

Solscan's public PYTH page displayed **304,585 holders** shortly afterward. Our unique-owner count is 185 lower (approximately 0.061%). Its displayed count is close to the positive token-account count, but that alone does not establish Solscan's methodology; collection timing can also differ. No Solscan API was used.

## Limitation and next decision

Convex documents 64 MiB memory for its standard runtime and 512 MiB for Node actions. The simple full-response JSON parsing approach measured well above both limits locally. This is a local feasibility measurement, not a deployed Convex out-of-memory test. A data slice reduces binary account data but retains nearly a million account wrapper objects.

The original specification explicitly requires stopping and documenting a limitation before implementing a substantially different architecture. Therefore the production collector and /growth page are pending a revised collection approach.

Candidate next approach: validate Helius `getProgramAccountsV2` pagination with the same filters and dataSlice, processing bounded pages and deduplicating owners across the full scan. This needs live validation of complete pagination, memory, runtime, and consistency while accounts change. It reuses Helius but changes the requested RPC method. Alternatively, streaming JSON parsing could preserve the single standard RPC call, with more parser complexity and the same large daily download. Neither alternative has been implemented or validated.

## Work retained

- Isolated strict owner/bigint parser: `lib/growth/holders.ts`
- Tests written first: `tests/pythHolders.test.ts` (14 passing)
- Read-only live request probe: `scripts/validate-pyth-holders.mjs`
- No daily persistence tests yet because persistence is not implemented.

## References

- https://docs.convex.dev/production/state/limits
- https://helius.mintlify.app/rpc/guides/getprogramaccounts
- https://solscan.io/token/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3

Verification: 14 parser tests pass. TypeScript passes after regenerating stale Next route types with `next typegen`. Targeted ESLint is blocked by the repository's existing configuration error (`Converting circular structure to JSON` in ESLint FlatCompat validation).

# Approved paginated implementation

The user approved Helius pagination after reviewing the single-response limitation.

`getProgramAccountsV2` now processes at most 10,000 accounts per request, retains unique owner strings across pages, and discards each page. It follows continuation cursors even on short or empty pages, rejects missing/repeated cursors, malformed data, network/HTTP/JSON-RPC failures, and zero-holder results. A 30-second page timeout and 8-minute overall deadline leave headroom below Convex's Node action limit. Base58 strings are flattened before retention to avoid excessive string-rope memory.

Validated locally with a 256 MiB V8 heap cap:

- 97 pages; 961,015 total token accounts
- 304,589 positive token accounts; 304,400 unique owners
- 272,887,336 total response bytes (pagination reduces peak memory, not total downloaded data)
- 21,718 ms; 309.7 MiB peak process RSS

The development Convex deployment successfully ran the real collector:

- 18,543 ms; 97 pages
- 304,399 unique holders; 304,588 positive accounts
- First development snapshot: 2026-09-10T18:22:23.766Z
- No production deployment has been performed.

The daily schedule is 03:00 UTC. Same-day runs preserve the first successful canonical snapshot. A failed run never writes a point. The internal collector skips an already collected day. Convex's transactional indexed mutation protects against concurrent duplicate inserts.

The /growth page uses reactive snapshot queries and paginated history, with 30D/90D/ALL filters, period change after two successful points, UTC collection time, overdue status, and a chart that breaks across missed days. The browser receives only daily snapshots. Since pagination spans multiple slots, methodology describes a short collection window rather than claiming an atomic single-slot count.

Validation: all 25 holder tests pass; TypeScript passes; changed files pass ESLint using the installed Next flat configs through a temporary config. The repository's existing FlatCompat config remains broken. Full test suite: 104 pass, 2 existing staking-discovery tests fail in tests/pythActions.test.ts. Browser validation confirmed the stored count, chart point, navigation, and all three period filters.

Helius pagination reference: https://www.helius.dev/docs/api-reference/rpc/http/getprogramaccountsv2

Production rollout: deploy these Convex changes to production with the existing PRIMARY_SOLANA_RPC_URL configured there, then deploy Next.js. The daily job will create the first production snapshot at 03:00 UTC; alternatively run the internal pythHolderCollection:collect once after deployment for an immediate initial snapshot. Do not copy the development snapshot or backfill earlier days.
