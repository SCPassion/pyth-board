import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatPythAmount, formatTimeAgo, truncateAddress } from "@/lib/sells/format";

describe("formatPythAmount", () => {
  it("formats amounts under 10K with comma separators", () => {
    expect(formatPythAmount(9_999)).toBe("9,999");
  });

  it("formats 10K+ as K with one decimal when non-zero", () => {
    expect(formatPythAmount(10_000)).toBe("10K");
    expect(formatPythAmount(100_000)).toBe("100K");
    expect(formatPythAmount(123_456)).toBe("123.5K");
  });

  it("formats 1M+ as M with two decimals when non-zero", () => {
    expect(formatPythAmount(1_000_000)).toBe("1M");
    expect(formatPythAmount(5_000_000)).toBe("5M");
    expect(formatPythAmount(1_234_567)).toBe("1.23M");
  });
});

describe("truncateAddress", () => {
  it("returns first 8 and last 8 chars with ellipsis", () => {
    const addr = "Ax4f9KmR3pQZ8XwYvNbCdEfGhJkLoT1";
    expect(truncateAddress(addr)).toBe("Ax4f9KmR...GhJkLoT1");
  });

  it("returns address unchanged if 16 chars or shorter", () => {
    expect(truncateAddress("short")).toBe("short");
  });
});

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows seconds for events under 60s ago", () => {
    expect(formatTimeAgo(Date.now() - 30_000)).toBe("30s ago");
  });

  it("shows minutes for events between 60s and 60m ago", () => {
    expect(formatTimeAgo(Date.now() - 90_000)).toBe("1m ago");
  });

  it("shows hours for events between 1h and 24h ago", () => {
    expect(formatTimeAgo(Date.now() - 3_600_000)).toBe("1h ago");
  });

  it("shows days for events 24h+ ago", () => {
    expect(formatTimeAgo(Date.now() - 86_400_000)).toBe("1d ago");
  });
});
