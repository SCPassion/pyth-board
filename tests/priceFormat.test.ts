import { describe, expect, it } from "vitest";

import { formatUsdPriceTick } from "@/lib/price-format";

describe("formatUsdPriceTick", () => {
  it("keeps enough precision for PYTH price axis ticks", () => {
    expect(formatUsdPriceTick(0.0468)).toBe("$0.0468");
    expect(formatUsdPriceTick(0.0476)).toBe("$0.0476");
    expect(formatUsdPriceTick(0.0484)).toBe("$0.0484");
  });
});
