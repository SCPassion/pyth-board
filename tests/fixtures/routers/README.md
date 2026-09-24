# Router and direct-pool fixtures

Public mainnet Helius Parsed Events evidence from 2026-09-13 onward. To keep
regressions reviewable, the large Jupiter, OKX, and Titan cases retain the
complete normalized instructions, amounts, and transaction identities produced
by `decodeHelius`. Smaller cases retain their provider envelopes. No router
fixture is live collection or historical backfill.

Exceptions are explicitly projected evidence:
- `unsupported-wrapper-evidence.json` retains only transaction identity,
  top-level instructions and decoded swap instructions for diagnostics.
- `audit-100-regressions.json` contains five **normalized Transaction** objects,
  not Helius envelopes. They preserve every instruction and its position, named
  accounts, arguments and summary data; descriptions and remainingAccount roles
  were omitted. The cases are Raydium buy/sell, a Raydium outer
  router (supported in parser v6), an RFQ native settlement and an OKX fee/unwrap settlement (supported in v7). The fixture entries retain their signatures; finalized RPC supplied independent validation.

The Birdeye comparison motivated these cases. Titan split-buy evidence is retained
in `titan-buy.json`; Whirlpool v1/v2 direct buys were added subsequently.
Keep the decoded amounts, accounts, instruction hierarchy and summaries intact
when updating fixtures; do not replace real evidence with generated examples.

- `titan-transfer-leg.json` is a normalized Transaction fetched again on 2026-09-21.
  It retains instruction positions, named roles, arguments and summaries, omitting
  descriptions and remainingAccount roles. Finalized RPC independently confirmed
  the missing JUP 230 → ORCA 43 raw transfer leg.

- `wrapper-cycle-evidence.json` contains four normalized September 13 transactions
  independently checked against finalized RPC on September 21. Three complete
  E52/Nina cycles are v8 exclusions; G2E4 is a v9 arbitrage record with a
  verified 38,869-raw-PYTH DLMM host fee. All instructions are retained; descriptions and unnamed
  remainingAccount roles are omitted.

- `axiom-movement-evidence.json` projects the raw RPC envelope of
  `58Tvt4VTYHiP1xsby5iiGGVW9c2aAZAks6HAD8tF8soe9bg7L4LsuYzTXU9esKcGx97tUnfZXSV7FbyLn1Keu3CL`
  from the September 21 latest-100 sample. Raw instructions, static/loaded keys,
  identity, execution error and token balances are preserved. Logs, non-token
  balances and provider economic decoding are omitted. It validates movement
  accounting independently of a router decoder; it is not an Axiom trade adapter.

- `okx-mixed-pools-buy.json` and `okx-mixed-pools-sell.json` retain the
  normalized instructions from two bounded development webhook samples on
  September 23. Both V3 OKX routes use multiple inner pool programs; parser
  v18 verifies the customer's token input, output, fees, and completion event
  without listing the pool program IDs. The captured signatures are preserved.

- `dflow-token-buy.json`, `dflow-intermediate-pyth.json`, and
  `jupiter-recurring-usdc-buy.json` project three September 24 finalized
  transactions found through public PYTH-mint history. The projected parsed
  evidence was fetched as three targeted Helius decoded transactions; no webhook or
  historical publishing was used. The DFlow cases check an endpoint PYTH buy
  and a route that uses PYTH only between its endpoints. The Recurring case
  checks the net PYTH fill after the output-denominated DCA fee.

- `jupiter-recurring-mixed-pools-buy.json` projects another finalized fill of
  the user-identified Jupiter buyback order `E8sqLfFG8NaPUzghaxvJUnKPTHysbhpachEue3Kaf5Pu`.
  Its USDC → USDT → SOL → PYTH route uses two unnamed inner pools. One targeted
  Helius decoded-transaction read supplied the fixture. The parser verifies the
  recurring fill and records net PYTH after the output-denominated fee.
