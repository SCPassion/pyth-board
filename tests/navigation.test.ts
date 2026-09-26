import { describe, expect, it } from "vitest";

import { navItems } from "@/lib/navigation";

describe("sidebar navigation", () => {
  it("keeps Growth and hides Trading Activity while collection is paused", () => {
    expect(navItems.find(item => item.label === "Growth")?.href).toBe("/growth");
    expect(navItems.some(item => item.href === "/activity")).toBe(false);
  });
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
