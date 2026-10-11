const DAY_MS = 86_400_000;

export function isolatedSnapshotTimes(snapshots: readonly { date: string }[]): Set<number> {
  const times = new Set(snapshots.map(row => Date.parse(`${row.date}T00:00:00Z`)));
  return new Set([...times].filter(time => !times.has(time - DAY_MS) && !times.has(time + DAY_MS)));
}
