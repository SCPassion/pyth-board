const DEFAULT_SOLANA_RPC_ENDPOINTS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

export function getSolanaRpcEndpoints(): string[] {
  const raw = process.env.SOLANA_RPC_ENDPOINTS;
  if (!raw) {
    return DEFAULT_SOLANA_RPC_ENDPOINTS;
  }

  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_SOLANA_RPC_ENDPOINTS;
}
