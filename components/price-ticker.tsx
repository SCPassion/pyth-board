"use client";

import { useEffect, useState } from "react";
import { getRealtimePrices, type PriceData } from "@/action/priceActions";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Image from "next/image";

export function PriceTicker() {
  const [prices, setPrices] = useState<{
    sol: PriceData;
    pyth: PriceData;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const data = await getRealtimePrices();
      setPrices(data);
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    // Refresh prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !prices) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-8 w-20 bg-gray-700/50 rounded animate-pulse" />
        <div className="h-8 w-20 bg-gray-700/50 rounded animate-pulse" />
      </div>
    );
  }

  if (!prices) return null;

  const formatPrice = (price: number) => {
    if (price === 0) return "N/A";
    if (price < 0.01) return price.toFixed(4);
    if (price < 1) return price.toFixed(3);
    return price.toFixed(2);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  const PriceItem = ({ data, icon }: { data: PriceData; icon: string }) => {
    const isPositive = data.change24h > 0;
    const isNegative = data.change24h < 0;
    const changeColor = isPositive
      ? "text-green-400"
      : isNegative
      ? "text-red-400"
      : "text-gray-400";

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <Image
            src={icon}
            alt={data.symbol}
            width={20}
            height={20}
            className="w-5 h-5"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">
            ${data.symbol}
          </span>
          <span className="text-white text-sm font-semibold">
            ${formatPrice(data.price)}
          </span>
          <div className={`flex items-center gap-1 ${changeColor}`}>
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
            <span className="text-xs font-medium">
              {formatChange(data.change24h)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <PriceItem data={prices.sol} icon="/sol.webp" />
      <PriceItem data={prices.pyth} icon="/pyth.svg" />
    </div>
  );
}

