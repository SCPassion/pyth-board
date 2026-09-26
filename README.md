# Pyth Board

Pyth Board is an independent, read-only community dashboard for PYTH staking, token activity, DAO reserves, protocol revenue, and news. It is a personal, unofficial project and is not affiliated with or endorsed by the Pyth Data Association, Douro Labs, the Pythian Council, or Pyth Network data publishers. Figures can be incomplete, delayed, or incorrect and are not financial advice. Verify important information with official sources.

## Site pages

| Route | What it shows |
| --- | --- |
| `/` | Portfolio summary, staking balances and rewards, validators, and market metrics for tracked wallets. |
| `/wallets` | Per-wallet staking accounts, validator positions, APY, and rewards. Wallets are saved in the browser. |
| `/pythenians` | Pythenians NFT role and partner directory. |
| `/reserve` | DAO Treasury and Pythian Council Ops balances, tracked asset valuations, PYTH swaps, buyback metrics, and reserve history. |
| `/revenue` | Douro Labs reports from the Pyth forum: DAO distributions, revenue trends, product breakdowns, and a report archive. |
| `/growth` | Native PYTH holders and governance staker history, using daily snapshots. |
| `/activity` | Beta: observed PYTH trades across supported routes, with aggregate volumes and execution details. Currently hidden from navigation while collection is paused. |
| `/news` | Weekly Pyth digest and archive when digests are available. |
| `/about` | Project disclosures and data limitations. |

The header also shows SOL and PYTH prices and 24-hour changes. The layout supports mobile screens, and the site includes a web manifest and install prompt.

### Trading Activity status

Trading Activity is a **Beta** page backed by a separate webhook indexer. As of 25 September 2026, production and development collection are paused. The Activity navigation link is restored in the working tree for the next frontend deployment; `/activity` already serves previously stored trades. The production run recorded verified trades from webhook deliveries without automatic backfill or reconciliation, so its totals have partial coverage. Its period selector includes **Since start** for all stored trades from the collection start; chart points switch from hourly to daily for histories longer than 30 days. The page can show all observed trades or an adjusted view that excludes the sourced addresses in [`lib/tracker/identified-liquidity-bots.ts`](lib/tracker/identified-liquidity-bots.ts) from totals, chart, and rankings. The list currently contains one [Solscan-labeled liquidity bot](https://solscan.io/account/MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa); add further sourced addresses there. Recent trades remain visible in both views.

The most recent bounded development run received 170 unique signatures: all 170 were processed, producing 128 PYTH trade rows (61 buys and 67 sells), 23 no-trade classifications, and 19 parser reviews, with no processing failures. It observed Jupiter, Titan, and OKX routes as well as direct Orca and Raydium executions. These figures measure processing of **received** signatures, not webhook delivery completeness. Earlier checks found PYTH trades that the subscription missed. The [coverage report](reports/pyth-trade-indexer-coverage-2026-09-25.md) explains the reviews and Helius credit results.

Published trade totals therefore have **partial coverage**. Automatic historical ingestion, missed-webhook backfill, and tracker reconciliation are disabled. The Helius webhook alone does not start collection: the indexer's own collection switch must also be enabled. See [CHANGES.md](CHANGES.md) for the release scope.

### PYTH trade parser coverage

Production runs **parser v19**. The versions below refer to router programs or swap instructions, not the parser version. A mapped name alone does not establish a trade: the parser requires verified execution and amount evidence. Unresolved beneficial owners are excluded from wallet rankings; unsupported or ambiguous executions can remain for review.

| Router or product | Currently recognized execution | Limit |
| --- | --- | --- |
| Jupiter Swap | Route, shared-account, exact-out, token-ledger, and named `route_v2` variants. | Only verified PYTH endpoint trades are counted; PYTH used solely between route legs is excluded. |
| Jupiter Recurring (original DCA program) | Verified flash-fill executions and order attribution. | Does not establish coverage of the current private or shared Trigger V2/DCA order system. |
| Jupiter Trigger (legacy `j1o2…` program) | Verified `fill_order` executions, maker attribution, and partial fills. | Trigger V2 (`jupo…`) remains unverified. |
| Jupiter RFQ | Verified top-level RFQ V1 PYTH-to-native-SOL `fill`. | Other RFQ layouts, nested fills, and automated-order attribution are unverified. |
| Titan | Verified swap routes, including split fills. | Unknown execution branches remain in review. |
| DFlow | V4 decoding and fixtures are retained. | **Review-only for the initial scope:** new DFlow endpoint trades are held from published totals. A real PYTH sell has not been verified. |
| OKX DEX | Legacy and V3 router program mappings. V3 token-to-token and PYTH-to-native-SOL settlements verify customer transfers, output fees, and the completion event without requiring a particular inner pool program. | Other settlement shapes, including unverified native-SOL buys, remain in review. |
| Raydium Router and Whirlpool wrapper | Verified routed executions; the wrapper is identified by program ID, without assigning an app name. | Unknown branches or unresolved beneficial ownership are not inferred. |

| DEX or pool program | Verified swap instruction shapes | Limit |
| --- | --- | --- |
| Orca Whirlpool | `swap` and `swap_v2`. | Other Whirlpool instructions, including unverified two-hop layouts, are outside this scope. |
| Raydium CLMM | `swap` and `swap_v2`. | Direct venue parsing is mapped for `swap_v2`; raw pool evidence also supports narrowly verified classic `swap` executions. |
| Raydium LaunchLab | Exact-in buy and sell. | Other launch or swap layouts need evidence. |
| Raydium CPMM | Base-input swap. | Other instruction variants need evidence. |
| Meteora DLMM | Classic swap. | Other DLMM variants need evidence. |
| Meteora DAMM v2 | Verified `swap` pool execution, including a Jupiter CPI wrapper case. | Only the attested account, transfer, and ownership shape is promoted. |

These are **parser capabilities on retained evidence**, not a promise that the webhook discovers every transaction from these programs. The PYTH-mint/SWAP subscription missed verified trades in bounded trials; broader CPI/vault-only delivery and Trigger V2 coverage also remain unproven. See [CHANGES.md](CHANGES.md) for the release scope.

For Jupiter, Titan, and OKX, the inner pool name is not a trade eligibility list. A complete router execution summary or independently verified customer settlement establishes the PYTH buy or sell. If neither is available and an inner execution cannot be decoded, the transaction stays in review; an unknown pool is not silently counted or discarded. A Jupiter execution can still use DFlow as an inner venue; the review-only rule applies to DFlow as the outer router.

### Execution types checked with real PYTH transactions

| Execution | Verified buys | Verified sells | Remaining gap |
| --- | --- | --- | --- |
| Router swaps in the initial scope | Jupiter, Titan, OKX | Jupiter, Titan, OKX | PYTH used only as an intermediate route asset is excluded. Webhook delivery is partial. |
| DFlow outer-router swaps | Decoded buy evidence, held for review | — | Review-only in v19; no new DFlow trade rows enter published totals. A real sell has not been verified. |
| Jupiter legacy Trigger V1 limit fills | Buy | — | No retained PYTH sell fill; Trigger V2 has not been verified. |
| Jupiter original Recurring/DCA fills | Buy, including a team buyback fill through unnamed USDC → USDT → SOL → PYTH inner pools and an output-denominated PYTH fee | — | No retained PYTH sell fill; current Trigger V2 DCA attribution is unverified. |

An order deposit, cancellation, vault withdrawal, or DCA claim is not itself a trade. A router execution alone can establish the PYTH swap, but identifying the user's order type requires separate, verified order-program evidence. A limit or DCA fill routed through Titan or OKX may be recorded as a swap without a verified automated-order label. [Jupiter describes](https://developers.jup.ag/blog/lov2-correctness-under-failure) current Limit Order V2 order details as off-chain, so the swap alone cannot establish the order type.

## Data sources

- Staking positions come from the Pyth staking SDK and Solana RPC through server actions. Tracked wallet addresses are stored in browser `localStorage`; the site does not request wallet signing or store private keys.
- Reserve balances and swaps come from tracked Solana accounts. Convex jobs maintain reserve holdings and hourly buyback snapshots.
- Revenue reports come from the Pyth forum and are synced to Convex. A scheduled job generates the weekly news digest.
- Growth uses scheduled holder and governance staker collections. Trading Activity reads retained indexer records from Convex; tracker collection is currently paused.
- The SOL/PYTH header ticker uses DefiLlama current and historical prices. Other market views may use separate price sources.

Third-party APIs, RPC availability, collection schedules, and supported asset lists can affect freshness and coverage. Reserve valuation focuses on tracked assets such as SOL, PYTH, USDC, and USDT. Wallet onboarding requires both a Solana wallet address and a staking account address.

## Convex integration

The existing scheduled jobs for reserve holdings, buyback snapshots, news, reports, native holders, and governance stakers are unchanged. Trading Activity uses a separate HTTP webhook and worker; it adds no cron job. The Convex schema **is extended** with tracker-specific tables and indexes. Existing table definitions and their collection functions are unchanged.

## Run locally

Use a Node.js version compatible with Next.js 16 and npm. Install dependencies, then copy `.env.local.example` to `.env.local` and fill in the values needed for your development deployment. Set Convex environment variables in Convex rather than exposing provider keys as `NEXT_PUBLIC_*` values. In particular, keep `HELIUS_API_KEY` private; it is also used to authorize the Helius webhook endpoint.

```bash
npm install
cp .env.local.example .env.local
npm run dev:all
```

`dev:all` starts Next.js and Convex development together. Open [http://localhost:3000](http://localhost:3000). If Convex is already running, use `npm run dev` for the site alone. Local development does not require enabling the Trading Activity webhook collector.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run dev:convex` | Start Convex development. |
| `npm run dev:all` | Start Next.js and Convex development together. |
| `npm run dev:webpack` | Start Next.js development without the explicit Turbopack flag. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run lint` | Run the repository's lint script. |
| `npm run rebuild` | Rebuild installed npm packages. |

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI primitives, Zustand, Convex, Solana Web3.js, the Pyth staking SDK, Recharts, and Vitest.
