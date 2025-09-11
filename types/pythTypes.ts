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
};
