import { describe, expect, it } from "vitest";

import { navItems } from "@/lib/navigation";

describe("sidebar navigation", () => {
  it("routes the Protocol Revenue item to the Revenue page", () => {
    expect(
      navItems.find((item) => item.label === "Protocol Revenue")?.href
    ).toBe("/revenue");
  });

  it("routes the About item to the About page", () => {
    expect(navItems.find((item) => item.label === "About")?.href).toBe(
      "/about"
    );
  });
});
