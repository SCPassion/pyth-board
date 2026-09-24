export const PYTH_MINT = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3";
export const PYTH_DECIMALS = 6;
export const PARSER_VERSION = 19;
export const WINDOWS = {
  "1h": 3600000,
  "6h": 21600000,
  "24h": 86400000,
  "7d": 604800000,
  "30d": 2592000000,
} as const;
export type Window = keyof typeof WINDOWS | "since";
export const PRODUCTS = [
  "SWAP",
  "RECURRING",
  "TRIGGER",
  "UNKNOWN_JUPITER",
] as const;
export const ROUTER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
export const TOKEN_NAMES: Record<string, string> = {
  [PYTH_MINT]: "PYTH",
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
};
export function tokenName(mint: string) {
  return TOKEN_NAMES[mint] ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}
