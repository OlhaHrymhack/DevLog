import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const ROOT = join(__dirname, "..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

const README = read("README.md");
const ENV_EXAMPLE = read(".env.example");
const PRODUCT = read("docs/vault/product.md");
const PACKAGE = z.object({ scripts: z.record(z.string(), z.string()), engines: z.object({ node: z.string() }) }).parse(JSON.parse(read("package.json")));

const envEntries = [...ENV_EXAMPLE.matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)];

const section = (heading: string): string => {
  const start = README.indexOf(`\n${heading}\n`);
  if (start === -1) return "";
  const rest = README.slice(start + heading.length + 2);
  const next = rest.search(/\n#{2,3} /);
  return next === -1 ? rest : rest.slice(0, next);
};

const AGENT_POINTS = ["Навіщо.", "Кроки й tools.", "Як вирішує, що далі.", "Коли зупиняється.", "Structured output", "Валідація.", "Підтвердження."];

describe("README (DEV-013)", () => {
  it("DEV-013 AC-1: запуск командою з ТЗ — скрипт dev, engines і команда в README", () => {
    expect(PACKAGE.scripts.dev).toBe("next dev");
    expect(PACKAGE.engines.node).toBeTruthy();
    expect(README).toContain("npm install\nnpm run dev");
    expect(README).toContain(PACKAGE.engines.node);
  });

  it("DEV-013 AC-2: усі команди перевірок із README існують у package.json", () => {
    ["dev", "build", "lint", "typecheck", "test", "test:e2e", "db:seed", "smoke:ai"].forEach((name) => {
      expect(PACKAGE.scripts[name], name).toBeTruthy();
      expect(README, name).toContain(name === "test" ? "npm test" : `npm run ${name}`);
    });
  });

  it("DEV-013 AC-3: .env.example порожній, а таблиця змінних у README збігається з файлом", () => {
    const names = envEntries.map(([, name]) => name);
    expect(names.length).toBeGreaterThan(0);
    envEntries.forEach(([, name, value]) => expect(value?.trim() === "", `${name} must be empty`).toBe(true));
    const table = section("## Змінні середовища");
    const documented = [...table.matchAll(/^\| `([A-Z][A-Z0-9_]*)` \|/gm)].map((match) => match[1]);
    expect([...documented].sort()).toEqual([...names].sort());
  });

  it("DEV-013 AC-4: кожен агент A–D описаний за 7 пунктами", () => {
    ["### A. План на день", "### B. Декомпозиція", "### C. Статус-апдейт", "### D. Радар застряглих"].forEach((heading) => {
      const body = section(heading);
      expect(body, heading).not.toBe("");
      AGENT_POINTS.forEach((point) => expect(body, `${heading}: ${point}`).toContain(point));
    });
    ["DayPlan", "Decomposition", "StatusUpdate", "Triage"].forEach((schema) => expect(README).toContain(`\`${schema}\``));
  });

  it("DEV-013 AC-5: три хибні кейси (A — #42, B — дублікати, C — PR #999) з відтворенням через dev-панель", () => {
    const body = section("## Хибні кейси і як продукт їх обробляє");
    expect(body).toContain("`#42`");
    expect(body).toContain("дублює наявну підзадачу");
    expect(body).toContain("PR #999");
    expect(body).toContain("Зламати відповідь агента");
    expect(body).toContain("Як відтворити");
  });

  it("DEV-013 AC-6: README не містить секретів і посилається на AGENT_LOG (розділ авторки перевіряє git-diff і hook, не цей тест)", () => {
    expect(/sk-[A-Za-z0-9_-]{20,}/.test(README), "README contains a key-like string").toBe(false);
    expect(README).toContain("[`AGENT_LOG.md`](AGENT_LOG.md)");
  });

  it("DEV-013 AC-7: у матриці product.md кожна R-xx має статус: зроблено, пояснено в README або пише авторка", () => {
    const rows = PRODUCT.split("\n").filter((line) => /^\| R-\d\d \|/.test(line));
    expect(rows).toHaveLength(21);
    rows.forEach((row) => {
      const status = row.split("|").at(-2)?.trim() ?? "";
      expect(status, row.slice(0, 8)).toMatch(/^(зроблено|пояснено в README|пише авторка)/);
    });
  });
});
