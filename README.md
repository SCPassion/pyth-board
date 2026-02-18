# Pyth Board

Pyth Board is a Next.js dashboard for tracking Pyth staking positions and monitoring the Pyth Strategic Reserve.

Current stage: **v0.1.8 (beta)**.

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

### RPC configuration (required for reliability)

Set dedicated Solana RPC endpoints in `.env.local`:

```bash
SOLANA_RPC_ENDPOINTS=https://your-primary-rpc,https://your-secondary-rpc
```

If this is not set, the app falls back to the public mainnet endpoint, which is often rate-limited.

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
- Token prices are fetched from Pyth Hermes; ticker 24h change uses CoinGecko.
- Wallets are stored locally in browser `localStorage`.

## Current limitations

- Wallet onboarding uses Solana wallet address only; staking account is derived automatically.
- Reserve valuation currently focuses on tracked assets (SOL, PYTH, USDC, USDT).
- No dedicated automated test suite is included yet.
- Network/RPC reliability can affect freshness; fallback endpoints are used when possible.

## Notes

- This app is read-only and does not request wallet signing.
- No private keys are stored by the app.

