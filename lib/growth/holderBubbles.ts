export type BubblePoint = { owner: string; x: number; y: number; radius: number };
export type BubbleWeight = { owner: string; weight: bigint };

/** Deterministic initial packing leaves room for bubbles to drift and displace each other. */
export function layoutHolderBubbles(entries: BubbleWeight[], width: number, height: number): BubblePoint[] {
  if (!entries.length || width < 64 || height < 64) return [];
  const sorted = [...entries].sort((a, b) => a.weight === b.weight ? a.owner.localeCompare(b.owner) : a.weight > b.weight ? -1 : 1);
  const maximum = sorted[0].weight;
  const minimum = entries.length > 50 ? 12 : 18;
  const gap = 4;
  const padding = 5;
  function pack(scale: number) {
    const placed: BubblePoint[] = [];
    for (const entry of sorted) {
      const ratio = maximum > 0n ? Number(entry.weight * 1_000_000n / maximum) / 1_000_000 : 0;
      const radius = minimum + Math.sqrt(ratio) * scale;
      const candidates = placed.length ? placed.flatMap(point => Array.from({ length: 32 }, (_, i) => {
        const angle = i * Math.PI / 16;
        const distance = point.radius + radius + gap;
        return { x: point.x + Math.cos(angle) * distance, y: point.y + Math.sin(angle) * distance };
      })) : [{ x: width / 2, y: height / 2 }];
      candidates.sort((a, b) => (a.x - width / 2) ** 2 + (a.y - height / 2) ** 2 - (b.x - width / 2) ** 2 - (b.y - height / 2) ** 2);
      const position = candidates.find(candidate => candidate.x >= radius + padding && candidate.x <= width - radius - padding
        && candidate.y >= radius + padding && candidate.y <= height - radius - padding
        && placed.every(point => (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2 >= (radius + point.radius + gap - 0.001) ** 2));
      if (!position) return null;
      placed.push({ owner: entry.owner, ...position, radius });
    }
    return placed;
  }
  let low = 0, high = Math.min(width, height) * 0.3;
  let result = pack(0);
  for (let i = 0; i < 8; i++) {
    const scale = (low + high) / 2;
    const attempt = pack(scale);
    if (attempt) { low = scale; result = attempt; } else high = scale;
  }
  if (!result) return [];
  const points = result.map(point => ({ ...point, radius: Math.max(12, point.radius * 0.9) }));
  // Tangent packing can leave an asymmetric cluster. Center it, then use available
  // horizontal space without reducing any pair's separation or changing bubble sizes.
  const left = Math.min(...points.map(point => point.x - point.radius));
  const right = Math.max(...points.map(point => point.x + point.radius));
  const center = (left + right) / 2;
  const stretch = Math.max(1, Math.min(...points.flatMap(point => {
    const distance = Math.abs(point.x - center);
    return distance > 0.001 ? [(width / 2 - point.radius - padding) / distance] : [];
  }).concat([3])));
  return points.map(point => ({ ...point, x: width / 2 + (point.x - center) * stretch }));
}
