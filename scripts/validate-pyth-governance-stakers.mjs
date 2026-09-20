/** Read-only Helius scan; compiles the production collector into temporary ESM. */
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { Connection, PublicKey } from "@solana/web3.js";
import { createRequire } from "node:module";
const { PythStakingClient, deserializeStakeAccountPositions, getVotingTokenAmount } = createRequire(import.meta.url)("@pythnetwork/staking-sdk");

const temp = await mkdtemp(join(tmpdir(), "pyth-governance-"));
try {
  for (const name of ["governanceStakers", "governanceCollector"]) {
    const source = await readFile(new URL(`../lib/growth/${name}.ts`, import.meta.url), "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
      .replace('"./governanceStakers"', '"./governanceStakers.mjs"');
    await writeFile(join(temp, `${name}.mjs`), output);
  }
  const { collectGovernanceStakers, requireHeliusEndpoint } = await import(pathToFileURL(join(temp, "governanceCollector.mjs")));
  const endpoint = requireHeliusEndpoint(process.env.PRIMARY_SOLANA_RPC_URL);
  // Client construction is local. Never call SDK networking methods.
  const client = new PythStakingClient({ connection: new Connection(endpoint), wallet: {
    publicKey: PublicKey.default, signTransaction: async () => { throw Error("Read only"); }, signAllTransactions: async () => { throw Error("Read only"); },
  } });
  let checked = 0;
  const sizes = {};
  const result = await collectGovernanceStakers(endpoint, {
    pageSize: process.env.GOVERNANCE_PAGE_SIZE ? Number(process.env.GOVERNANCE_PAGE_SIZE) : undefined,
    onAccount(data, epoch, amount) {
      const decoded = deserializeStakeAccountPositions(PublicKey.default, data, client.stakingProgram.idl);
      if (getVotingTokenAmount(decoded, epoch) !== amount || decoded.data.owner.toBuffer().toString("hex") !== data.subarray(8, 40).toString("hex")) throw Error("SDK decoding mismatch");
      sizes[data.length] = (sizes[data.length] ?? 0) + 1;
      checked++;
      if (checked % 10000 === 0) console.error(`Validated ${checked} accounts; peak RSS ${(process.resourceUsage().maxRSS / 1024).toFixed(1)} MiB`);
    },
  });
  console.log(JSON.stringify({ ...result, runtimeMs: result.collectedAt - result.startedAt,
    sdkAccountsChecked: checked, accountSizes: sizes, peakRssMiB: process.resourceUsage().maxRSS / 1024 }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Validation failed");
  process.exitCode = 1;
} finally { await rm(temp, { recursive: true, force: true }); }
