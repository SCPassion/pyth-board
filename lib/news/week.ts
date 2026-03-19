const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function buildDigestWeekWindow(endMs: number) {
  return {
    startMs: endMs - WEEK_MS,
    endMs,
  };
}

export function formatWeekKey(endMs: number) {
  return new Date(endMs).toISOString().slice(0, 10);
}

export function formatWeekLabel(endMs: number) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(endMs));

  return `Week of ${formatted}`;
}
