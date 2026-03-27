import { describe, it, expect } from "vitest";
import { assignTier, toUtcDateKey, extractSellData, extractBuyData } from "./sellsUtils";

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
    expect(assignTier(5_000_000)).toBe("whale");
  });
});

describe("toUtcDateKey", () => {
  it("formats a UTC timestamp as YYYY-MM-DD", () => {
    // 2026-03-25T00:00:00.000Z = 1774396800000
    expect(toUtcDateKey(1774396800000)).toBe("2026-03-25");
  });

  it("uses the UTC date boundary, not local time", () => {
    // 2026-03-24T23:59:59.999Z — must resolve to Mar 24, not Mar 25
    expect(toUtcDateKey(1774396799999)).toBe("2026-03-24");
  });
});

describe("extractSellData", () => {
  const validTransfers = [
    {
      fromUserAccount: "SellerWallet111",
      toUserAccount: "JupiterProgram",
      mint: PYTH_MINT,
      tokenAmount: 50_000,
    },
    {
      fromUserAccount: "JupiterProgram",
      toUserAccount: "SellerWallet111",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      tokenAmount: 1500,
    },
  ];

  it("extracts seller address, pythAmount, toToken, toAmount from valid transfers", () => {
    const result = extractSellData(validTransfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.fromAddress).toBe("SellerWallet111");
    expect(result!.pythAmount).toBe(50_000);
    expect(result!.toToken).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result!.toAmount).toBe(1500);
  });

  it("returns null when there is no PYTH outbound transfer", () => {
    const transfers = [
      {
        fromUserAccount: "Someone",
        toUserAccount: "SellerWallet111",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1000,
      },
    ];
    expect(extractSellData(transfers, PYTH_MINT)).toBeNull();
  });

  it("maps symbol to toTokenSymbol when present on inbound transfer", () => {
    const transfers = [
      {
        fromUserAccount: "SellerWallet111",
        toUserAccount: "JupiterProgram",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
      {
        fromUserAccount: "JupiterProgram",
        toUserAccount: "SellerWallet111",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1500,
        symbol: "USDC",
      },
    ];
    const result = extractSellData(transfers, PYTH_MINT);
    expect(result!.toTokenSymbol).toBe("USDC");
  });

  it("falls back to unknown toToken and 0 toAmount when no inbound transfer is found", () => {
    const transfers = [
      {
        fromUserAccount: "SellerWallet111",
        toUserAccount: "JupiterProgram",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
    ];
    const result = extractSellData(transfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.toToken).toBe("unknown");
    expect(result!.toAmount).toBe(0);
  });
});

describe("extractBuyData", () => {
  const validTransfers = [
    {
      fromUserAccount: "JupiterProgram",
      toUserAccount: "BuyerWallet111",
      mint: PYTH_MINT,
      tokenAmount: 50_000,
    },
    {
      fromUserAccount: "BuyerWallet111",
      toUserAccount: "JupiterProgram",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      tokenAmount: 1500,
    },
  ];

  it("extracts buyer address, pythAmount, fromToken, fromAmount from valid transfers", () => {
    const result = extractBuyData(validTransfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.toAddress).toBe("BuyerWallet111");
    expect(result!.pythAmount).toBe(50_000);
    expect(result!.fromToken).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result!.fromAmount).toBe(1500);
  });

  it("returns null when there is no PYTH inbound transfer", () => {
    const transfers = [
      {
        fromUserAccount: "BuyerWallet111",
        toUserAccount: "JupiterProgram",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1000,
      },
    ];
    expect(extractBuyData(transfers, PYTH_MINT)).toBeNull();
  });

  it("maps symbol to fromTokenSymbol when present on outbound transfer", () => {
    const transfers = [
      {
        fromUserAccount: "JupiterProgram",
        toUserAccount: "BuyerWallet111",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
      {
        fromUserAccount: "BuyerWallet111",
        toUserAccount: "JupiterProgram",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1500,
        symbol: "USDC",
      },
    ];
    const result = extractBuyData(transfers, PYTH_MINT);
    expect(result!.fromTokenSymbol).toBe("USDC");
  });

  it("falls back to unknown fromToken and 0 fromAmount when no outbound leg found", () => {
    const transfers = [
      {
        fromUserAccount: "JupiterProgram",
        toUserAccount: "BuyerWallet111",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
    ];
    const result = extractBuyData(transfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.fromToken).toBe("unknown");
    expect(result!.fromAmount).toBe(0);
  });

  it("falls back when outbound leg belongs to a different account", () => {
    const transfers = [
      {
        fromUserAccount: "JupiterProgram",
        toUserAccount: "BuyerWallet111",
        mint: PYTH_MINT,
        tokenAmount: 50_000,
      },
      {
        fromUserAccount: "OtherWallet",  // different account, not BuyerWallet111
        toUserAccount: "JupiterProgram",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        tokenAmount: 1500,
      },
    ];
    const result = extractBuyData(transfers, PYTH_MINT);
    expect(result).not.toBeNull();
    expect(result!.fromToken).toBe("unknown");
    expect(result!.fromAmount).toBe(0);
  });
});
