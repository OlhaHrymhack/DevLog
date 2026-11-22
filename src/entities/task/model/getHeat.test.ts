import { describe, expect, it } from "vitest";
import { getHeat } from "./getHeat";
import type { HeatInput } from "./types";

const NOW = Date.UTC(2026, 10, 21, 12, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function task(overrides: Partial<HeatInput> & { staleDays?: number }): HeatInput {
  const { staleDays = 0, ...rest } = overrides;
  return { status: "todo", priority: "medium", updatedAt: NOW - staleDays * DAY, ...rest };
}

describe("getHeat", () => {
  it("DEV-002 AC-2: done → done, навіть із дедлайном у минулому", () => {
    expect(getHeat(task({ status: "done" }), NOW).key).toBe("done");
    expect(getHeat(task({ status: "done", dueAt: NOW - 5 * DAY }), NOW).key).toBe("done");
  });

  it("DEV-002 AC-2: дедлайн через 20 год → alarm; через 30 год (high, 0 днів) → fresh", () => {
    expect(getHeat(task({ priority: "high", dueAt: NOW + 20 * HOUR }), NOW).key).toBe("alarm");
    expect(getHeat(task({ priority: "high", dueAt: NOW + 30 * HOUR }), NOW).key).toBe("fresh");
  });

  it("DEV-002 AC-2: прострочений дедлайн не done → alarm; alarm сильніший за low", () => {
    expect(getHeat(task({ dueAt: NOW - 2 * HOUR }), NOW).key).toBe("alarm");
    expect(getHeat(task({ priority: "low", dueAt: NOW + 2 * HOUR }), NOW).key).toBe("alarm");
  });

  it("DEV-002 AC-2: low (10 днів без змін) → calm", () => {
    expect(getHeat(task({ priority: "low", staleDays: 10 }), NOW).key).toBe("calm");
  });

  it("DEV-002 AC-2: high 2/3/5/7 днів → fresh/warm/hot/fire", () => {
    function heat(staleDays: number) {
      return getHeat(task({ priority: "high", staleDays }), NOW).key;
    }
    expect(heat(2)).toBe("fresh");
    expect(heat(3)).toBe("warm");
    expect(heat(4)).toBe("warm");
    expect(heat(5)).toBe("hot");
    expect(heat(6)).toBe("hot");
    expect(heat(7)).toBe("fire");
  });

  it("DEV-002 AC-2: medium 3 і 8 днів → warm (зупиняється на warm); 2 дні → fresh", () => {
    function heat(staleDays: number) {
      return getHeat(task({ priority: "medium", staleDays }), NOW).key;
    }
    expect(heat(3)).toBe("warm");
    expect(heat(8)).toBe("warm");
    expect(heat(2)).toBe("fresh");
  });

  it("DEV-002 AC-2: приймає ISO-рядки й Date, now — параметр", () => {
    const stale = new Date(NOW - 7 * DAY).toISOString();
    expect(getHeat({ status: "todo", priority: "high", updatedAt: stale }, new Date(NOW)).key).toBe("fire");
  });

  it("DEV-002 AC-2: у списку показуються лише рівні warm і вище", () => {
    expect(getHeat(task({ priority: "high", staleDays: 5 }), NOW).show).toBe(true);
    expect(getHeat(task({}), NOW).show).toBe(false);
  });
});
