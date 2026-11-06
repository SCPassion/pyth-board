import Image from "next/image";

const TOKEN_ICONS = {
  PYTH: "/pyth.svg",
  USDC: "/usdc.webp",
} as const;

export function TokenIcon({
  symbol,
  size = 18,
  className = "",
}: {
  symbol: keyof typeof TOKEN_ICONS;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={TOKEN_ICONS[symbol]}
      alt={symbol}
      title={symbol}
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function TokenUnitLabel({ symbol }: { symbol: keyof typeof TOKEN_ICONS }) {
  return (
    <p className="font-data mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[#8f88a9]">
      <TokenIcon symbol={symbol} size={12} />
      {symbol}
    </p>
  );
}
