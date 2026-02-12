import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "fetch pyth reserve holdings daily",
  { hours: 24 },
  internal.reserveSnapshots.runPythHoldingSnapshotJob,
  {}
);

export default crons;
