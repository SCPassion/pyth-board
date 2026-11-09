import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children,
}));

import { PortfolioSummary } from "@/components/portfolio-summary";

function render(props: Partial<Parameters<typeof PortfolioSummary>[0]>) {
  return renderToStaticMarkup(
    createElement(PortfolioSummary, {
      connectedWallets: 1,
      totalStaked: 250_000,
      pythPrice: 0.06,
      ...props,
    })
  );
}

describe("PortfolioSummary 24h stake value change", () => {
  it("shows the dollar gain from the 24h price move", () => {
    const html = render({ pythPrice24hAgo: 0.05 });
    expect(html).toContain("$15,000");
    expect(html).toContain("+$2,500");
  });

  it("shows a loss with a minus sign", () => {
    expect(render({ pythPrice24hAgo: 0.07 })).toContain("−$2,500");
  });

  it("hides the change without a 24h price or any stake", () => {
    expect(render({})).not.toContain("24h");
    expect(render({ totalStaked: 0, pythPrice24hAgo: 0.05 })).not.toContain("24h");
  });
});
