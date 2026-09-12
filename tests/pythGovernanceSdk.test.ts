import { createRequire } from "node:module";
import { Connection, PublicKey } from "@solana/web3.js";
import { expect, it } from "vitest";
import { decodeGovernanceStake, POSITION_DISCRIMINATOR } from "../lib/growth/governanceStakers";
import { stakeData, type Position } from "./governanceFixtures";
const { PythStakingClient, deserializeStakeAccountPositions, getVotingTokenAmount } = createRequire(import.meta.url)("@pythnetwork/staking-sdk") as typeof import("@pythnetwork/staking-sdk");

it("matches the installed SDK discriminator, owners, and voting amounts without RPC calls", () => {
  const client = new PythStakingClient({ connection: new Connection("https://mainnet.helius-rpc.com"), wallet: {
    publicKey: PublicKey.default, signTransaction: async () => { throw Error("Read only"); }, signAllTransactions: async () => { throw Error("Read only"); },
  } });
  expect(Buffer.from(client.stakingProgram.idl.accounts!.find(a => a.name === "positionData")!.discriminator)).toEqual(POSITION_DISCRIMINATOR);
  const positions: Position[] = [null, { amount: 0n }, { amount: 2n ** 64n - 1n },
    { activation: 11n }, { unlocking: 11n }, { unlocking: 10n }, { unlocking: 9n }, { ois: true }];
  for (const data of [stakeData(3, positions), Buffer.concat([stakeData(4, []), Buffer.alloc(24)])]) {
    for (const epoch of [9n, 10n, 11n, 12n]) {
      const local = decodeGovernanceStake(data, epoch);
      const sdk = deserializeStakeAccountPositions(PublicKey.default, data, client.stakingProgram.idl);
      expect(local.owner).toBe(sdk.data.owner.toBuffer().toString("hex"));
      expect(local.votingAmount).toBe(getVotingTokenAmount(sdk, epoch));
    }
  }
});
