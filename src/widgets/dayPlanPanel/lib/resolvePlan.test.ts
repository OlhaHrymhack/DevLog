import { describe, expect, it } from "vitest";
import { resolvePlan } from "./resolvePlan";

const TITLES = [{ id: "t1", title: "Перша" }, { id: "t2", title: "Друга" }];
const WHY = "Високий пріоритет, багато днів без змін.";
const DATA = {
  items: [{ taskId: "t2", why: WHY, joke: "Жарт" }, { taskId: "t1", why: WHY, joke: null }],
  deferred: [{ taskId: "t1", reason: "може почекати день" }],
};

describe("resolvePlan", () => {
  it("DEV-009 AC-5: результат агента → записи з назвами, поясненнями й жартом", () => {
    const plan = resolvePlan(DATA, TITLES, { fromRule: false, serious: false });
    expect(plan?.items).toEqual([{ id: "t2", title: "Друга", why: WHY, joke: "Жарт" }, { id: "t1", title: "Перша", why: WHY, joke: null }]);
    expect(plan?.deferred).toEqual([{ id: "t1", title: "Перша", reason: "може почекати день" }]);
  });

  it("DEV-009 AC-8: у серйозному режимі жарти відкидаються, у fallback немає й пояснень", () => {
    expect(resolvePlan(DATA, TITLES, { fromRule: false, serious: true })?.items.every((item) => item.joke === null)).toBe(true);
    const fromRule = resolvePlan(DATA, TITLES, { fromRule: true, serious: false });
    expect(fromRule?.items.every((item) => item.why === undefined && item.joke === undefined)).toBe(true);
  });

  it("DEV-009 AC-5: видалені після запуску задачі пропускаються, невалідні дані дають null", () => {
    expect(resolvePlan(DATA, [{ id: "t1", title: "Перша" }], { fromRule: false, serious: false })?.items.map((item) => item.id)).toEqual(["t1"]);
    expect(resolvePlan({ items: [] }, TITLES, { fromRule: false, serious: false })).toBeNull();
    expect(resolvePlan(null, TITLES, { fromRule: false, serious: false })).toBeNull();
  });
});
