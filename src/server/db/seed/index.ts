import "server-only";
import { agentRuns } from "../../agentRuns/schema";
import { seedTasks } from "../../tasks/seed/seed";
import type { DevLogDb } from "../client";

export const seedDatabase = (db: DevLogDb, now: Date): number => db.transaction((tx) => {
  tx.delete(agentRuns).run();
  return seedTasks(tx, now);
}, { behavior: "immediate" });
