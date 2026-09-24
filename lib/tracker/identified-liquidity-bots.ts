// Add a sourced address here to include it in the adjusted Trading Activity view.
export const IDENTIFIED_LIQUIDITY_BOTS = [
  {
    address: "MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa",
    label: "Wintermute Automated Liquidity Bot",
    source: "Solscan",
    sourceUrl:
      "https://solscan.io/account/MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa",
  },
] as const;

export const IDENTIFIED_LIQUIDITY_BOT_ADDRESSES = IDENTIFIED_LIQUIDITY_BOTS.map(
  ({ address }) => address,
);
