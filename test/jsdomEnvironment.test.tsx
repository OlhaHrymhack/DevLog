import { describe, expect, it } from "vitest";

describe("Vitest environments", () => {
  it("DEV-001 AC-2: *.test.tsx виконуються в jsdom", () => {
    const element = document.createElement("div");
    element.textContent = "DevLog";
    document.body.append(element);
    expect(document.body.textContent).toContain("DevLog");
    expect(typeof window).toBe("object");
  });
});
