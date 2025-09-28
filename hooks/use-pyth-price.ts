"use client";

import { useState, useEffect } from "react";
import { getPythPrice } from "@/action/pythActions";

export function usePythPrice() {
  const [pythPrice, setPythPrice] = useState<number | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      const price = await getPythPrice();
      price && setPythPrice(price);
    }

    fetchPrice();
  }, []);

  return pythPrice;
}
