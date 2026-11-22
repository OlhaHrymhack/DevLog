import { logger } from "../logger";
import { getDb } from "./client";
import { seedDatabase } from "./seed";

const connection = getDb();
try {
  const tasks = seedDatabase(connection.db, new Date());
  logger.info({ tasks }, "Seeded demo tasks");
} finally {
  connection.close();
}
