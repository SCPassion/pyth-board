import { describe, expect, it } from "vitest";
import {
  assignTier,
  extractPythEvents,
  toUtcDateKey,
  type AccountData,
  type TokenTransfer,
} from "./sellsUtils";

const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

describe("assignTier", () => {
  it("returns shrimp for amounts under 10K", () => {
    expect(assignTier(1)).toBe("shrimp");
    expect(assignTier(9_999)).toBe("shrimp");
  });

  it("returns dolphin for 10K–50K (inclusive)", () => {
    expect(assignTier(10_000)).toBe("dolphin");
    expect(assignTier(50_000)).toBe("dolphin");
  });

  it("returns whale for over 50K", () => {
    expect(assignTier(50_001)).toBe("whale");
  });
});

describe("toUtcDateKey", () => {
  it("formats a UTC timestamp as YYYY-MM-DD", () => {
    expect(toUtcDateKey(1774396800000)).toBe("2026-03-25");
  });

  it("uses the UTC date boundary, not local time", () => {
    expect(toUtcDateKey(1774396799999)).toBe("2026-03-24");
  });
});

describe("extractPythEvents", () => {
  it("returns no events when there is no PYTH delta", () => {
    const accountData: AccountData[] = [
      {
        account: "NeutralAta",
        nativeBalanceChange: 0,
        tokenBalanceChanges: [
          {
            userAccount: "NeutralWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "1000", decimals: 6 },
          },
          {
            userAccount: "NeutralWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "-1000", decimals: 6 },
          },
        ],
      },
    ];

    expect(extractPythEvents(accountData, [], PYTH_MINT)).toEqual([]);
  });

  it("classifies the fee payer net increase as a buy", () => {
    const accountData: AccountData[] = [
      {
        account: "BuyerPythAta",
        nativeBalanceChange: 0,
        tokenBalanceChanges: [
          {
            userAccount: "BuyerWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "981868", decimals: 6 },
          },
        ],
      },
    ];

    expect(extractPythEvents(accountData, [], PYTH_MINT, { feePayer: "BuyerWallet111" })).toEqual([
      {
        walletAddress: "BuyerWallet111",
        direction: "buy",
        pythAmount: 0.981868,
        matchedVia: "net_delta",
      },
    ]);
  });

  it("classifies the fee payer net decrease as a sell", () => {
    const accountData: AccountData[] = [
      {
        account: "SellerPythAta",
        nativeBalanceChange: 0,
        tokenBalanceChanges: [
          {
            userAccount: "SellerWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "-22500000000", decimals: 6 },
          },
        ],
      },
    ];

    expect(extractPythEvents(accountData, [], PYTH_MINT, { feePayer: "SellerWallet111" })).toEqual([
      {
        walletAddress: "SellerWallet111",
        direction: "sell",
        pythAmount: 22_500,
        matchedVia: "net_delta",
      },
    ]);
  });

  it("falls back to a single wallet delta when fee payer is not present", () => {
    const accountData: AccountData[] = [
      {
        account: "SingleWallet",
        nativeBalanceChange: 0,
        tokenBalanceChanges: [
          {
            userAccount: "WhaleWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "10000000000", decimals: 6 },
          },
        ],
      },
    ];

    expect(extractPythEvents(accountData, [], PYTH_MINT)).toEqual([
      {
        walletAddress: "WhaleWallet111",
        direction: "buy",
        pythAmount: 10_000,
        matchedVia: "net_delta",
      },
    ]);
  });

  it("prefers the fee payer when multiple wallets changed PYTH", () => {
    const accountData: AccountData[] = [
      {
        account: "Mixed",
        nativeBalanceChange: 0,
        tokenBalanceChanges: [
          {
            userAccount: "BuyerWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "23903490", decimals: 6 },
          },
          {
            userAccount: "PoolWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "-23903490", decimals: 6 },
          },
        ],
      },
    ];

    expect(extractPythEvents(accountData, [], PYTH_MINT, { feePayer: "BuyerWallet111" })).toEqual([
      {
        walletAddress: "BuyerWallet111",
        direction: "buy",
        pythAmount: 23.90349,
        matchedVia: "net_delta",
      },
    ]);
  });

  it("falls back to the single positive delta when one buy and one sell are present", () => {
    const accountData: AccountData[] = [
      {
        account: "Mixed",
        nativeBalanceChange: 0,
        tokenBalanceChanges: [
          {
            userAccount: "BuyerWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "986028", decimals: 6 },
          },
          {
            userAccount: "SellerWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "-986028", decimals: 6 },
          },
        ],
      },
    ];

    expect(extractPythEvents(accountData, [], PYTH_MINT)).toEqual([
      {
        walletAddress: "BuyerWallet111",
        direction: "buy",
        pythAmount: 0.986028,
        matchedVia: "net_delta",
      },
    ]);
  });

  it("returns no events when multiple wallets changed PYTH and no simple resolution exists", () => {
    const accountData: AccountData[] = [
      {
        account: "Mixed",
        nativeBalanceChange: 0,
        tokenBalanceChanges: [
          {
            userAccount: "BuyerWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "14268", decimals: 6 },
          },
          {
            userAccount: "OtherBuyer111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "14268", decimals: 6 },
          },
          {
            userAccount: "PoolWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "-28536", decimals: 6 },
          },
        ],
      },
    ];

    expect(extractPythEvents(accountData, [], PYTH_MINT)).toEqual([]);
  });

  it("classifies a DCA-like tiny net increase as a buy for the fee payer", () => {
    const accountData: AccountData[] = [
      {
        account: "BuyerPythAta",
        nativeBalanceChange: 0,
        tokenBalanceChanges: [
          {
            userAccount: "BuyerWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "5", decimals: 6 },
          },
        ],
      },
    ];

    expect(
      extractPythEvents(accountData, [], PYTH_MINT, {
        feePayer: "BuyerWallet111",
      })
    ).toEqual([
      {
        walletAddress: "BuyerWallet111",
        direction: "buy",
        pythAmount: 0.000005,
        matchedVia: "net_delta",
      },
    ]);
  });

  it("classifies a buy from transfer legs on any swap router", () => {
    const transfers: TokenTransfer[] = [
      {
        fromUserAccount: "BuyerWallet111",
        toUserAccount: "PoolWallet111",
        mint: "So11111111111111111111111111111111111111112",
        tokenAmount: 0.03366307,
      },
      {
        fromUserAccount: "PoolWallet111",
        toUserAccount: "BuyerWallet111",
        mint: PYTH_MINT,
        tokenAmount: 74.81,
      },
    ];

    expect(extractPythEvents([], transfers, PYTH_MINT, { feePayer: "BuyerWallet111" })).toEqual([
      {
        walletAddress: "BuyerWallet111",
        direction: "buy",
        pythAmount: 74.81,
        matchedVia: "swap_transfers",
      },
    ]);
  });

  it("classifies a sell from transfer legs on any swap router", () => {
    const transfers: TokenTransfer[] = [
      {
        fromUserAccount: "SellerWallet111",
        toUserAccount: "PoolWallet111",
        mint: PYTH_MINT,
        tokenAmount: 674.91,
      },
      {
        fromUserAccount: "PoolWallet111",
        toUserAccount: "SellerWallet111",
        mint: "So11111111111111111111111111111111111111112",
        tokenAmount: 0.303621,
      },
    ];

    expect(extractPythEvents([], transfers, PYTH_MINT, { feePayer: "SellerWallet111" })).toEqual([
      {
        walletAddress: "SellerWallet111",
        direction: "sell",
        pythAmount: 674.91,
        matchedVia: "swap_transfers",
      },
    ]);
  });

  it("records a buy but ignores a later send in the same swap transaction", () => {
    const transfers: TokenTransfer[] = [
      {
        fromUserAccount: "BuyerWallet111",
        toUserAccount: "PoolWallet111",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 2.5,
      },
      {
        fromUserAccount: "PoolWallet111",
        toUserAccount: "BuyerWallet111",
        mint: PYTH_MINT,
        tokenAmount: 67.5,
      },
      {
        fromUserAccount: "BuyerWallet111",
        toUserAccount: "FriendWallet111",
        mint: PYTH_MINT,
        tokenAmount: 67.49,
      },
    ];

    expect(extractPythEvents([], transfers, PYTH_MINT, { feePayer: "BuyerWallet111" })).toEqual([
      {
        walletAddress: "BuyerWallet111",
        direction: "buy",
        pythAmount: 67.5,
        matchedVia: "swap_transfers",
      },
    ]);
  });

  it("falls back to net delta when transfer legs are missing", () => {
    const accountData: AccountData[] = [
      {
        account: "BuyerPythAta",
        nativeBalanceChange: 0,
        tokenBalanceChanges: [
          {
            userAccount: "BuyerWallet111",
            mint: PYTH_MINT,
            rawTokenAmount: { tokenAmount: "5", decimals: 6 },
          },
        ],
      },
    ];

    expect(
      extractPythEvents(accountData, [], PYTH_MINT, {
        feePayer: "BuyerWallet111",
      })
    ).toEqual([
      {
        walletAddress: "BuyerWallet111",
        direction: "buy",
        pythAmount: 0.000005,
        matchedVia: "net_delta",
      },
    ]);
  });
});
