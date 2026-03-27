import { describe, it, expect } from "vitest";
import { assignTier, toUtcDateKey, extractSellData } from "./sellsUtils";

const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";

describe("assignTier", () => {
  it("returns minor for amounts under 10K PYTH", () => {
    expect(assignTier(1)).toBe("minor");
    expect(assignTier(9_999)).toBe("minor");
  });

  it("returns significant for 10K–99.9K PYTH", () => {
    expect(assignTier(10_000)).toBe("significant");
    expect(assignTier(99_999)).toBe("significant");
  });

  it("returns large for 100K–999.9K PYTH", () => {
    expect(assignTier(100_000)).toBe("large");
    expect(assignTier(999_999)).toBe("large");
  });

  it("returns whale for 1M+ PYTH", () => {
    expect(assignTier(1_000_000)).toBe("whale");
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
