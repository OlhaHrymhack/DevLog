import { describe, expect, it } from "vitest";
import { parseDetailsTab } from "./detailsTab";

describe("parseDetailsTab", () => {
  it("DEV-007 AC-6: ?tab=decompose і ?tab=update відкривають свої вкладки", () => {
    expect(parseDetailsTab("decompose")).toBe("decompose");
    expect(parseDetailsTab("update")).toBe("update");
  });

  it("DEV-007 AC-6: відсутній або некоректний параметр → «Задача»", () => {
    expect(parseDetailsTab(null)).toBe("task");
    expect(parseDetailsTab(undefined)).toBe("task");
    expect(parseDetailsTab("")).toBe("task");
    expect(parseDetailsTab("agent")).toBe("task");
  });
});
