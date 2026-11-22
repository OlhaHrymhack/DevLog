import { describe, expect, it } from "vitest";
import { t } from "./copy.uk";
import { getTaskListQuery, isSortOption } from "./useTaskListParams";

describe("Task list controls", () => {
  it("DEV-005 AC-3: maps sort options to the API field and order", () => {
    expect(getTaskListQuery("priority-asc", "done", "  тест ")).toEqual({
      sort: "priority", order: "asc", status: "done", q: "тест",
    });
    expect(getTaskListQuery("date-desc")).toMatchObject({ sort: "createdAt", order: "desc" });
    expect(getTaskListQuery("date-asc")).toMatchObject({ sort: "createdAt", order: "asc" });
    expect(isSortOption("toString")).toBe(false);
  });

  it("DEV-005 AC-10: selects the serious or playful empty copy", () => {
    expect(t("emptyTitle", true)).toBe("Поки що задач немає");
    expect(t("emptyTitle", false)).toBe("Нічого не горить");
  });
});
