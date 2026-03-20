"use client";

import { createContext, useContext } from "react";

export type AppLoadingState = {
  isLoading: boolean;
  isRefreshingWallets: boolean;
  lastWalletRefreshAt: number | null;
  walletRefreshError: string | null;
};

export const AppLoadingContext = createContext<AppLoadingState>({
  isLoading: false,
  isRefreshingWallets: false,
  lastWalletRefreshAt: null,
  walletRefreshError: null,
});

export const useAppLoading = () => useContext(AppLoadingContext);
