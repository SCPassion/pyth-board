# Mainnet golden transaction fixtures

These are public mainnet transactions retrieved through Helius Parsed Events on
2026-09-12. `normal-buy.json`, `normal-sell.json`, and `recurring-buy-1.json`
retain the provider envelopes to test decoding. The other seven files retain
the complete normalized instructions, amounts, and identities produced by
`decodeHelius`, omitting provider display fields the parser never reads. They
are used only in tests and are not imported into live tracking history.

Normal trades and the route cycle were discovered from PYTH mint history.
Recurring fills were found in public council-wallet history. Trigger fills were
located through Jupiter's public V1 order history, then fetched independently by
signature from Helius. Cancellation was fetched from legacy program history.

| Fixture | Mainnet signature |
| --- | --- |
| `normal-buy.json` | `4e5wtQ9FLk6maXJD7Uj8euubgCnvraR6YhZcsZUsBAuA4oDwT2CpJsWH933iza7U9bMkpfTxc3EgPTyYywsoXGok` |
| `normal-sell.json` | `2TZECuxktT7gppyeMmBGZuFCVpPxafRxzpoXNYoYgZ7APZQBsssugyGkM2LX1iCFFu9fkWJf6SgTH4nor4NRYJuX` |
| `recurring-buy-1.json` | `5j74p2Lvp2bUUUvZgZn2s7JFjQtt246mbBMBAfQqWVPi79izsFSaHgANNHaS4a7c26MXoSowFf19oiif1LuPmqDF` |
| `recurring-buy-2.json` | `32vvBcbNAAMD5xo3kzcPXV4Sq3tWXaqYYfX1x5MQzjhEm6Uz8zao31F2mDxPZ3sjmPQ6URsxAFy8f92C9wgk66TM` |
| `recurring-buy-3.json` | `4Sm3gcDHb3yCnVLbRvAi6xwtWAWgDc5GLwoBJfo2MeEpCWjiG3uvxwNVQdz7jSVjJP7Av8zNZvE3g2X5haic1PT3` |
| `route-cycle.json` | `YT1NS7ML3Rd21CBSeYHYgL6T1gr7fFWHdrNMnp3KdVRH6tMdsbbeKE3jvvUy1P1yuqe9jrAR8sSMisfxzRaJYd9` |
| `trigger-buy-1.json` | `PKZQLubzrgvGpP7co1r6fu7zZySmjJvRFqGYHCc97Z2vXuVhLVcFnXRrmqJTwQSMcA65gq7McHXQ1Dagp9VL6ne` |
| `trigger-buy-2.json` | `2KfED5F2PEdqoxLM9H2DSgix893MprMRdZibLXXLBV6m21Y28Nyj3286XSCWWumR7yrw1QcoCSzfz48YKqhS9eY2` |
| `trigger-buy-3.json` | `eNAYNyNKra527dddWDMQP76qQUjKkGFkerPgrkqTA6YyBeNSMi23vgbv6h7wq8Q1QSbmTQneqd3oaw9YnM7kxE5` |
| `trigger-cancel.json` | `4KnddHvkkUwHRodfWux9xobArZp9Zs2QTPBE432xbrFYxG4FG2NXYiQYutaXzeprunw5RbBsw8zjHYxMCBKKwHJS` |

Assertions live in `tests/tracker.test.ts`. Fill output expectations are checked
against the `Filled` / `TradeEvent` amounts and economic owner, not the
transaction signer. The route-cycle fixture is expected to return no PYTH trade.

Synthetic edge cases are constructed explicitly in the test file and are never
represented as real mainnet fixtures. Additional automated sell, exact-out and
vault-only fixtures remain an activation requirement (see the tracker runbook).
