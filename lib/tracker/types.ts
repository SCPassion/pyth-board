import type { PRODUCTS } from "./config";
export type Product = (typeof PRODUCTS)[number];
export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "UNRESOLVED";
export type RouteLeg = {
  inputMint: string;
  outputMint: string;
  inputAmountRaw: string;
  outputAmountRaw: string;
  dexProgramId: string | null;
  dexName: string | null;
};
export type Trade = {
  router?: string;
  tradeId: string;
  signature: string;
  slot: number;
  blockTime: number;
  side: "BUY" | "SELL";
  inputMint: string;
  outputMint: string;
  inputAmountRaw: string;
  outputAmountRaw: string;
  pythAmountRaw: string;
  counterMint: string;
  counterAmountRaw: string;
  counterDecimals: number;
  product: Product;
  owner: string | null;
  ownerConfidence: Confidence;
  classificationConfidence: "HIGH" | "MEDIUM";
  executionProgramId: string;
  executionAuthority: string | null;
  orderKey: string | null;
  routeLegs: RouteLeg[];
  flags: string[];
  parserVersion: number;
  usdValue: number | null;
  priceUsd: number | null;
  priceTimestamp: number | null;
  priceSource: string | null;
};
export type Program = {
  programId: string;
  product: Product;
  instructionNames: string[];
  ownerRole: string | null;
  orderRole: string | null;
  verified: boolean;
};
export type Instruction = {
  programName?: string;
  instructionIndex: number;
  innerInstructionIndex: number | null;
  stackHeight: number | null;
  programId: string;
  instructionName: string | null;
  accounts: Record<string, string>;
  summary: Record<string, unknown> | null;
  args: Record<string, unknown>;
};
export type Transaction = {
  signature: string;
  slot: number;
  blockTime: number;
  success: boolean;
  instructions: Instruction[];
  decimals: Record<string, number>;
};
export type OrderLink = {
  orderKey: string;
  owner: string;
  product: Product;
  programId: string;
  sourceSignature: string;
};
export type ArbitrageExecution = {
  kind: "ARBITRAGE_WITH_HOST_FEE";
  executionId: string;
  signature: string;
  slot: number;
  blockTime: number;
  executionProgramId: string;
  executionAuthority: string;
  parserVersion: number;
  settlements: {
    mint: string;
    decimals: number;
    tokenAccount: string;
    debitRaw: string;
    creditRaw: string;
    netRaw: string;
  }[];
  hostFee: {
    mint: string;
    amountRaw: string;
    tokenAccount: string;
    programId: string;
  };
  routeLegs: RouteLeg[];
};
export type ParseResult = {
  stateAnalysis?: import("./state-analysis").StateAnalysis;
  movementAccounting?: import("./movements").MovementAccounting;
  arbitrages?: ArbitrageExecution[];
  trades: Trade[];
  orders: OrderLink[];
  review: string[];
};
