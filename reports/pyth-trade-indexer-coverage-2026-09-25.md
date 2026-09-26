# PYTH trade indexer coverage and production readiness

25 September 2026. This report covers the development deployment and the
retained 40-minute webhook test. It does not claim complete Solana trade
coverage or a measured production monthly bill.

## Decision

The optimized code is ready for a **controlled Beta production deployment with
collection disabled**. The Activity navigation link is included in this working
tree, so the page will be visible after the next frontend deployment and will
show "Collection paused" until the indexer is enabled. A short, monitored
production canary is still needed
before leaving collection on. The page's qualified promise is to show verified
PYTH trades delivered to the indexer, with partial coverage. It does not promise
every trade on a named venue. Production has not received this code or had
collection enabled.

## Received transaction outcomes

The development webhook window received 170 distinct candidates. A read-only
development snapshot after the drain shows 128 `STORED`, 23 `IGNORED`, 19
`PARSE_REVIEW`, and no pending or failed candidates in that window. The 128
stored rows comprise 61 buys and 67 sells, all classified as swaps. Their
router labels are:

| Router label | Stored trades |
| --- | ---: |
| Orca Whirlpool | 79 |
| Raydium CLMM | 26 |
| Jupiter | 14 |
| State-verified exchange | 5 |
| OKX DEX | 2 |
| Titan | 2 |

Of the 128 stored trades, 124 have an owner and four have unresolved ownership.
Those four still have verified economic amounts, but are excluded from wallet
rankings where ownership is required. The short live window did not exercise
all documented products and route variants. Historical fixture and retained
transaction tests provide the remaining parser evidence; they do not establish
live webhook delivery completeness.

## Review cases

The review rows retain both Helius Parsed Events data and finalized raw RPC
evidence. They are not pending queue jobs and do not automatically become
published trades. The raw-evidence audit found:

| Group | Cases | Finding | Action |
| --- | ---: | --- | --- |
| Titan | 14 | Thirteen have no verified customer PYTH endpoint in the retained evidence; many move equal PYTH amounts into and out of an intermediate route account. One has a credible signer-level PYTH buy candidate but includes an undecoded branch (`SV2EYY…`). | Keep the 13 unproven cases in review rather than infer endpoints. Investigate and fixture the one buy candidate before publishing it. |
| Other unsupported programs | 4 | Two `FsWx…` and two legacy `JUP4…` executions show equal PYTH movements through intermediate accounts, with no verified customer endpoint. | Keep in review unless a complete customer exchange and route boundary can be proven. |
| DFlow outer router | 1 | Decoded PYTH sell evidence, deliberately held by the documented review-only scope. | Keep in review until DFlow is separately verified and approved for publication. |

The one Titan buy candidate is signature
`PzKXYcQLu9CpcqLbnowRE6QbsKjjouc7erEQVhytDzDREWcd9JT5MDdfWuL7pnGgGZhjTB6Wytiwi9gTfizwdg5`.
Raw account changes suggest 2,989.052078 PYTH received against 216.631115
USDT spent, but the unknown branch prevents a complete execution proof. It is
therefore excluded. The 19 reviewed candidates are not equivalent to 19
confirmed missing trades.

## Page coverage contract

`app/activity/page.tsx` promises **observed** buys and sells across verified
executions. `components/activity/trading-methodology.tsx` lists the verified
Jupiter, Titan, OKX, Raydium Router, Whirlpool wrapper, Orca, Raydium pool, and
Meteora shapes; it explicitly holds DFlow outer routes for review and discloses
missed webhook deliveries and absent automatic backfill. The optimization only
changes the provider request path and freshness. Direct raw shortcuts apply to
fully reconciled, single Orca Whirlpool or Raydium CLMM pool swaps; other
qualifying transactions still use Parsed Events. Historical comparison of 113
retained signatures reproduced all 104 previously stored trade economics.

Current gaps remain: unknown Titan branches, Trigger V2 order attribution,
unverified venue instruction variants, DFlow outer routes, and missed webhook
deliveries. The page's partial-coverage language must remain visible. Published
totals should not be described as total PYTH market volume.

## Credit and freshness result

The live indexer used eight Parsed Events requests for 125 signatures requiring
provider parsing. At the observed 100 credits per Enhanced request, that is
about 800 Enhanced credits versus 12,500 for one request per signature: 11,700
credits saved, or 93.6% on those parse candidates. The 50-job/10-minute buffer
can delay new rows by roughly ten minutes. Finalized raw transaction evidence
still determines execution success; parsed responses are matched to their
requested signatures. Retries and replays retain the same accuracy guards.

Malformed-response isolation for the primary batch is now capped at eight
paid Parsed Events requests per drain; unresolved signatures remain reviewable. The Activity
page's delayed-processing warning now allows for the intended ten-minute
buffer plus a three-minute grace period.

If the unusually busy 40-minute window persisted all month, the existing
queue model estimates approximately 532K Enhanced credits per 30 days at this
buffer setting, before RPC, webhooks, or other site activity. This is a stress
extrapolation, not a steady-state measurement. The shared one-million-credit
limit requires a production canary and account-wide monitoring.

## Verification and rollout gate

- Development Convex functions pushed successfully; collection remains off.
- `npx tsc --noEmit`, `npm run build`, and all 497 tests pass, including 309
  tracker tests. The navigation test now checks the Activity link, and the
  staking RPC tests use the current two-endpoint setup. Staking behavior was
  not changed.
- No code was committed or pushed. No production settings were changed.

For rollout, deploy the code with production collection off. Then run a bounded
production canary after the webhook is enabled by its owner. Check candidate
counts, stored and review outcomes, queue age, request logs, and credits per
Parsed Events request. Keep collection on only if the observed account-wide
credit rate leaves sufficient headroom below one million credits per month.
