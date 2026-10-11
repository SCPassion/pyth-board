type Props = {
  times: ReadonlySet<number>;
  cx?: number;
  cy?: number;
  stroke?: string;
  payload?: { time: number };
};

export function IsolatedSnapshotDot({ times, cx, cy, stroke, payload }: Props) {
  if (!payload || !times.has(payload.time) || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return <circle className="recharts-line-dot" cx={cx} cy={cy} r={3} fill={stroke} stroke={stroke} aria-hidden="true" />;
}
