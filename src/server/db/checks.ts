import { sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

export const oneOf = (column: SQLiteColumn, values: readonly string[]) =>
  sql`${column} in (${sql.join(values.map((value) => sql.raw("'" + value.replaceAll("'", "''") + "'")), sql`, `)})`;
