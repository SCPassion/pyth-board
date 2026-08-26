import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "fetch pyth reserve holdings daily",
  { hours: 24 },
  internal.reserveSnapshots.runPythHoldingSnapshotJob,
  {}
);

crons.interval(
  "fetch pyth buyback metrics hourly",
  { hours: 1 },
  internal.pythBuybackSnapshots.runPythBuybackSnapshotJob,
  {}
);

crons.weekly(
  "generate weekly pyth digest",
  { dayOfWeek: "thursday", hourUTC: 1, minuteUTC: 0 },
  internal.news.generateWeeklyDigest,
  {}
);

crons.daily(
  "sync pyth pro douro reports",
  { hourUTC: 2, minuteUTC: 15 },
  internal.pythPro.syncDouroReports,
  {}
);

export default crons;
