import { parseServerEnv } from "@/shared/config/env";
import { logger } from "../logger";
import { DB_COMMANDS, DbCommandError, isDbCommand, runDbCommand } from "./operations";

const main = async () => {
  const command = process.argv[2];
  if (!isDbCommand(command)) {
    logger.error({ command, allowed: DB_COMMANDS }, "Unknown database command");
    process.exitCode = 2;
    return;
  }
  const { DATABASE_URL, DATABASE_AUTH_TOKEN } = parseServerEnv(process.env);
  try {
    const result = await runDbCommand(command, { url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN });
    logger.info(result, "Database command finished");
  } catch (error) {
    if (!(error instanceof DbCommandError)) throw error;
    logger.error({ command }, error.message);
    process.exitCode = 1;
  }
};

void main();
