import { describe, expect, it } from "vitest";

import { navItems } from "@/lib/navigation";

describe("sidebar navigation", () => {
  it("routes the Revenue item to the Revenue page", () => {
    expect(navItems.find((item) => item.label === "Revenue")?.href).toBe(
      "/revenue"
    );
  });
});
