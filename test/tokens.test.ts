import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const TOKENS_CSS = path.join(ROOT, "docs/design/tokens.css");
const GLOBALS_CSS = path.join(ROOT, "src/app/globals.css");

/** Блоки без вкладених дужок: селектор → { змінна → значення }. Коментарі відкидаються. */
function parseVariableBlocks(css: string): Map<string, Map<string, string>> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = new Map<string, Map<string, string>>();
  for (const [, rawSelector = "", body = ""] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rawSelector.replace(/\s+/g, " ").trim();
    const variables = new Map<string, string>();
    for (const [, name = "", value = ""] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      variables.set(name, value.replace(/\s+/g, " ").trim());
    }
    if (variables.size > 0 && !blocks.has(selector)) blocks.set(selector, variables);
  }
  return blocks;
}

const tokens = parseVariableBlocks(fs.readFileSync(TOKENS_CSS, "utf8"));
const globals = parseVariableBlocks(fs.readFileSync(GLOBALS_CSS, "utf8"));

describe("design tokens", () => {
  it("DEV-002 AC-1: tokens.css містить блоки :root, dark і light (контроль, що парсер щось знайшов)", () => {
    expect([...tokens.keys()]).toEqual([
      ":root",
      ':root,[data-theme="dark"],.dark',
      '[data-theme="light"],.light',
    ]);
    expect(tokens.get(':root,[data-theme="dark"],.dark')?.size).toBeGreaterThan(30);
  });

  for (const selector of tokens.keys()) {
    it(`DEV-002 AC-1: globals.css має ті самі змінні й значення для ${selector}`, () => {
      const expected = tokens.get(selector) ?? new Map<string, string>();
      const actual = globals.get(selector);
      expect(actual, `у globals.css немає блоку ${selector}`).toBeDefined();
      expect(Object.fromEntries(actual ?? [])).toEqual(Object.fromEntries(expected));
    });
  }
});
