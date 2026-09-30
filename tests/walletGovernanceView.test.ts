import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WalletInfo } from "@/types/pythTypes";
const { state, loading } = vi.hoisted(() => ({
  state: { wallets: [] as WalletInfo[], removeWallet: vi.fn(), setWallets: vi.fn(), addWallet: vi.fn() },
  loading: { isRefreshingWallets: false },
}));
vi.mock("@/store/store", () => ({ useWalletInfosStore: Object.assign(() => state, { getState: () => state }) }));
vi.mock("@/components/app-loading-context", () => ({ useAppLoading: () => loading }));
vi.mock("@/action/pythActions", () => ({ refreshGovernanceStakingInfo: vi.fn(), getGovernanceStakingInfo: vi.fn() }));
import WalletsPage from "@/app/wallets/page";
import { WalletSection } from "@/components/wallet-section";
import { WalletDropdown } from "@/components/wallet-dropdown";
import { PortfolioSummary } from "@/components/portfolio-summary";

const account = { address: "GovernanceStakeAccount", totalStakedPyth: 190, activePyth: 100, warmingUpPyth: 20, unstakingPyth: 70 };
const wallet: WalletInfo = { id: "main", name: "Main wallet", address: "SolanaWallet", stakingAddress: account.address,
  stakingInfo: { kind: "governance", ...account, stakingAccounts: [account] } };
beforeEach(() => { state.wallets = [wallet]; loading.isRefreshingWallets = false; });

describe("governance wallet presentation", () => {
  it("shows governance states and accounts without rewards, APY, or validators", () => {
    const html = renderToStaticMarkup(createElement(WalletsPage));
    expect(html).toContain("190 PYTH");
    expect(html).toContain("Warming up");
    expect(html).toContain("Unstaking");
    expect(html).toContain("GovernanceStakeAccount");
    expect(html).not.toMatch(/rewards|APY|validator/i);
  });
  it("shows unavailable rather than a zero for a failed legacy migration refresh", () => {
    const html = renderToStaticMarkup(createElement(WalletSection, { wallet: { ...wallet, stakingInfo: null } }));
    expect(html).toContain("Unavailable");
    expect(html).toContain("Refresh");
    expect(html).not.toContain("0 PYTH");
  });
  it("shows a loading state while governance positions are first refreshed", () => {
    loading.isRefreshingWallets = true;
    const html = renderToStaticMarkup(createElement(WalletSection, { wallet: { ...wallet, stakingInfo: null } }));
    expect(html).toContain("Loading…");
    expect(html).not.toContain("Unavailable");
  });
  it("describes governance tracking in the wallet dropdown", () => {
    const html = renderToStaticMarkup(createElement(WalletDropdown, { isOpen: true, onClose: () => {} }));
    expect(html).toContain("Governance:");
    expect(html).toContain("190.00");
    expect(html).not.toMatch(/rewards|APY|validator/i);
  });
  it("removes claimable rewards from the dashboard portfolio", () => {
    const html = renderToStaticMarkup(createElement(PortfolioSummary, { connectedWallets: 1, totalStaked: 190, pythPrice: 0.1 }));
    expect(html).toContain("Total Governance Stake");
    expect(html).toContain("$19");
    expect(html).not.toMatch(/reward/i);
  });
  it("shows a real zero stake value when the price is available", () => {
    const html = renderToStaticMarkup(createElement(PortfolioSummary, { connectedWallets: 1, totalStaked: 0, pythPrice: 0.1 }));
    expect(html).toContain("$0");
    expect(html).not.toContain("Unavailable");
  });
});
