import { PRICE_FEED_DAY_MS, type PriceFeedSnapshot } from "./priceFeeds";

// Fictional daily history for visual previews, ending at the initial live counts.
export function priceFeedPreview(endDate: string): PriceFeedSnapshot[] {
  const end = Date.parse(`${endDate}T04:15:00Z`);
  return Array.from({ length: 90 }, (_, day) => {
    const remaining = 89 - day;
    const collectedAt = end - remaining * PRICE_FEED_DAY_MS;
    return {
      date: new Date(collectedAt).toISOString().slice(0, 10), collectedAt,
      stable: 1883 - Math.floor(remaining / 7) * 28 - Math.floor(remaining / 3) * 3,
      comingSoon: 1193 + Math.floor(remaining / 7) * 8 - Math.floor(remaining / 11) * 4,
      inactive: 777 - Math.floor(remaining / 9) * 7,
    };
  });
}
