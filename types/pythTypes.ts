export type PythStakingInfo = {
  StakeForEachPublisher: MyPublisherInfo[];
  totalStakedPyth: number;
  claimableRewards: number;
  generalStats: {
    totalGovernance: number;
    totalStaked: number;
    rewardsDistributed: number;
  };
};

export type MyPublisherInfo = {
  publisherKey: string;
  stakedAmount: number;
  apy: number;
  rewards: number;
};

export type PythGeneralStats = {
  totalGovernance: number;
  totalStaked: number;
  rewardsDistributed: number;
};

export type WalletInfo = {
  id: string;
  address: string;
  stakingAddress: string;
  name: string;
  stakingInfo: PythStakingInfo | null;
};

export type NFTRole = {
  id: string;
  name: string;
  description: string;
  image: string;
  projectUrl: string;
  discordInviteUrl: string;
  claimable: boolean;
};

export type TokenBalance = {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  usdValue?: number;
};

export type ReserveAccountInfo = {
  address: string;
  name: string;
  solBalance: number;
  tokenBalances: TokenBalance[];
  totalUsdValue: number;
  solPrice: number; // SOL price in USD from Hermes API
};

export type PythReserveSummary = {
  daoTreasury: ReserveAccountInfo;
  pythianCouncilOps: ReserveAccountInfo;
  totalReserveValue: number;
  totalPythHeld: number;
};

export type SwapTransaction = {
  signature: string;
  timestamp: number;
  date: string;
  block: number;
  inputToken: string;
  inputAmount: number;
  outputAmount: number; // PYTH amount
  postBalance: number; // PYTH balance after swap
  swapProgram: string;
  explorerUrl: string;
};
