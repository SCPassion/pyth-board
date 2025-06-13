import { WalletInfo } from "@/types/pythTypes";
import { create } from "zustand";

type WalletsInfoStore = {
  wallets: WalletInfo[];
  setWallets: (wallets: WalletInfo[]) => void;
  addWallet: (wallet: WalletInfo) => void;
  removeWallet: (walletId: string) => void;
};
export const useWalletInfosStore = create<WalletsInfoStore>((set) => ({
  wallets: [],
  setWallets: (wallets) => set({ wallets }),
  addWallet: (wallet) =>
    set((state) => ({
      wallets: [...state.wallets, wallet],
    })),
  removeWallet: (walletId) =>
    set((state) => ({
      wallets: state.wallets.filter((w) => w.id !== walletId),
    })),
}));
