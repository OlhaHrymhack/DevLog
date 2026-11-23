import { expect, it } from "vitest";
import { fromLocalDateTime, toLocalDateTime } from "./localDateTime";

it("DEV-016 AC-4: preserves a supported local deadline and rejects an invalid calendar date", () => {
  const wallTime = "2026-11-24T17:00";
  const iso = fromLocalDateTime(wallTime);
  expect(iso).toBe(new Date(wallTime).toISOString());
  expect(toLocalDateTime(new Date(iso ?? ""))).toBe(wallTime);
  expect(fromLocalDateTime("2026-02-30T17:00")).toBeUndefined();
  expect(fromLocalDateTime("")).toBeUndefined();
});
