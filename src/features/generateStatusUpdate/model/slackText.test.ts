import { describe, expect, it } from "vitest";
import { parseSlack, parseSlackLine } from "./slackText";

describe("розбір Slack-розмітки", () => {
  it("DEV-011 AC-1: *жирний* стає bold-сегментом, решта рядка лишається текстом", () => {
    expect(parseSlackLine("*Rate limiting*: апдейт")).toEqual([
      { text: "Rate limiting", bold: true }, { text: ": апдейт", bold: false },
    ]);
    expect(parseSlackLine("без розмітки")).toEqual([{ text: "без розмітки", bold: false }]);
    expect(parseSlackLine("2 * 3 = 6")).toEqual([{ text: "2 * 3 = 6", bold: false }]);
  });

  it("DEV-011 AC-8: HTML у тексті не інтерпретується — це лише текстовий сегмент", () => {
    expect(parseSlack("🕵️ <img src=x onerror=alert(1)>\nДалі")).toEqual([
      [{ text: "🕵️ <img src=x onerror=alert(1)>", bold: false }], [{ text: "Далі", bold: false }],
    ]);
  });
});
