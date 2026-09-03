# Pyth Board

Pyth Board is an independent dashboard built and maintained by a member of the Pyth community. It is a personal, unofficial project.

It is not affiliated with, sponsored by, or endorsed by the Pyth Data Association, Douro Labs, the Pythian Council, or any institution that publishes data to the Pyth Network. 
None of those parties develops, operates, reviews, or verifies this site, and none of them is responsible for its content, availability, or accuracy.
Figures shown here are derived from public on-chain data and third-party price sources, and may be incomplete, delayed, or wrong. Nothing on this site is financial advice. Always verify against official sources before acting on anything you see here.

## What is live right now

- Multi-wallet staking tracking for Pyth OIS positions
- Portfolio and wallet-level staking summaries
- Live PYTH price usage in dashboard metrics
- Header price ticker for **SOL** and **PYTH** with 24h change
- Pythenians NFT role directory page
- Strategic Reserve page (`/reserve`) with:
  - DAO Treasury + Pythian Council Ops balances
  - USD valuation for tracked assets
  - Recent swaps into PYTH (paginated)
  - Buyback metrics for Council Ops USDC -> PYTH execution:
    - Total USDC spent
    - Total PYTH bought
    - Weighted average buy price over time (hourly snapshots)
- Mobile-responsive layout with persistent sidebar/top header
- Local wallet persistence (`localStorage`)
- Installable PWA prompt + web manifest support

## App routes

- `/` - Portfolio dashboard (summary cards + general protocol metrics)
- `/wallets` - Connected wallet list and per-wallet staking details
- `/pythenians` - NFT role/partner showcase
- `/reserve` - Strategic reserve balances and PYTH swap activity (**beta**)

## Tech stack

- Next.js `16.1.1` (App Router)
- React `19`
- TypeScript
- Tailwind CSS v4 + shadcn/ui + Radix UI
- Zustand for client state
- Solana Web3.js + `@pythnetwork/staking-sdk`
- Recharts (dashboard visualizations)

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

```bash
npm run dev          # Next dev (Turbopack)
npm run dev:webpack  # Next dev (Webpack)
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint
npm run rebuild      # npm rebuild
```

## How data is fetched

- Wallet staking data is fetched via server actions using Pyth staking SDK + Solana RPC.
- Reserve balances are fetched from Solana RPC for tracked reserve addresses.
- Reserve buyback metrics are tracked in Convex via an hourly snapshot job that
  incrementally processes new Council Ops swaps.
- Token prices are fetched from Pyth Hermes; ticker 24h change uses CoinGecko.
- Wallets are stored locally in browser `localStorage`.

## Current limitations

- Wallet onboarding currently requires both:
  - Solana wallet address
  - Staking account address
- Reserve valuation currently focuses on tracked assets (SOL, PYTH, USDC, USDT).
- No dedicated automated test suite is included yet.
- Network/RPC reliability can affect freshness; fallback endpoints are used when possible.

## Notes

- This app is read-only and does not request wallet signing.
- No private keys are stored by the app.

ttß
