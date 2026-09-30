import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { governance, walletStore } = vi.hoisted(() => ({
  governance: { total: 1_200_000_000 as number | null, isLoading: false, retry: vi.fn() },
  walletStore: { wallets: [] as unknown[] },
}));

vi.mock("@/hooks/use-governance-total-staked", () => ({ useGovernanceTotalStaked: () => governance }));
vi.mock("@/store/store", () => ({ useWalletInfosStore: () => walletStore }));
vi.mock("@/hooks/use-pyth-price", () => ({ usePythPrice: () => null }));
vi.mock("@/components/app-loading-context", () => ({ useAppLoading: () => ({ isLoading: false }) }));
vi.mock("@/components/portfolio-summary", () => ({ PortfolioSummary: () => null }));
vi.mock("@/components/metric-cards", () => ({ MetricCards: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/pwa-install-context", () => ({ usePwaInstall: () => ({ canInstall: false }) }));
vi.mock("@/components/wallet-dropdown", () => ({ WalletDropdown: () => null }));
vi.mock("@/components/price-ticker", () => ({ PriceTicker: () => null }));

import Dashboard from "@/app/page";
import { GovernanceHeaderStat } from "@/components/governance-header-stat";
import { TopHeader } from "@/components/top-header";

beforeEach(() => {
  governance.total = 1_200_000_000;
  governance.isLoading = false;
  walletStore.wallets = [];
});

describe("governance header stat", () => {
  it("shows the network total in the header with no wallets and removes the dashboard section", () => {
    const header = renderToStaticMarkup(createElement(TopHeader, {
      isMobileMenuOpen: false, onMobileMenuToggle: () => {},
    }));
    expect(header).toContain("Governance staked");
    expect(header).toContain("1.2B PYTH");
    const html = renderToStaticMarkup(createElement(Dashboard));
    expect(html).not.toContain("General Information");
    expect(html).not.toContain("Governance staked");
    expect(html).not.toContain("OIS Total Staked");
    expect(html).not.toContain("OIS Rewards Distributed");
    expect(html).not.toContain("unique validators");
  });

  it("does not use stale totals from a saved wallet", () => {
    walletStore.wallets = [{ stakingInfo: { generalStats: { totalGovernance: 9_000_000_000 } } }];
    const html = renderToStaticMarkup(createElement(GovernanceHeaderStat));
    expect(html).toContain("1.2B");
    expect(html).not.toContain("9B");
  });

  it("shows a loading state without a zero balance", () => {
    governance.total = null;
    governance.isLoading = true;
    const html = renderToStaticMarkup(createElement(GovernanceHeaderStat));
    expect(html).toContain("Loading…");
    expect(html).not.toContain("0B");
  });

  it("shows unavailable with a retry action on RPC failure", () => {
    governance.total = null;
    const html = renderToStaticMarkup(createElement(GovernanceHeaderStat));
    expect(html).toContain("Unavailable");
    expect(html).toContain("Retry");
    expect(html).not.toContain("0B");
  });

  it("renders a real zero as a balance", () => {
    governance.total = 0;
    const html = renderToStaticMarkup(createElement(GovernanceHeaderStat));
    expect(html).toContain("0 PYTH");
    expect(html).not.toContain("Unavailable");
  });
});
