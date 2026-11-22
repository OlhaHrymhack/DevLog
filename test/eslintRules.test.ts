import path from "node:path";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const FIXTURES = path.join(ROOT, "eslint-fixtures");

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({
    cwd: FIXTURES,
    overrideConfigFile: path.join(ROOT, "eslint.config.mjs"),
  });
});

const lintFixture = async (relativePath: string) => {
  const filePath = path.join(FIXTURES, relativePath);
  const [result] = await eslint.lintFiles([filePath]);
  if (!result) {
    throw new Error(`ESLint returned no result for ${relativePath}`);
  }
  return result.messages;
};

const ruleIdsOf = async (relativePath: string) => {
  const messages = await lintFixture(relativePath);
  return messages.map((message) => message.ruleId);
};

describe("ESLint style-guide rules", () => {
  it("DEV-014 AC-1: function declaration як компонент → func-style", async () => {
    expect(await ruleIdsOf("src/features/sample/DeclarationComponent.tsx")).toEqual(["func-style"]);
  });

  it("DEV-001 AC-6: export default у features/ → no-restricted-syntax", async () => {
    expect(await ruleIdsOf("src/features/sample/defaultExport.ts")).toEqual(["no-restricted-syntax"]);
  });

  it("DEV-001 AC-6: імпорт widgets з entities → boundaries/dependencies", async () => {
    expect(await ruleIdsOf("src/entities/sample/importsWidget.ts")).toEqual(["boundaries/dependencies"]);
  });

  it("DEV-001 AC-6: імпорт src/server з features → boundaries/dependencies", async () => {
    expect(await ruleIdsOf("src/features/sample/importsServer.ts")).toEqual(["boundaries/dependencies"]);
  });

  it("DEV-001 AC-6: console.log → no-console", async () => {
    expect(await ruleIdsOf("src/features/sample/consoleLog.ts")).toEqual(["no-console"]);
  });

  it("DEV-001 AC-6: сусідній slice того ж шару → boundaries/dependencies", async () => {
    expect(await ruleIdsOf("src/features/sample/importsSibling.ts")).toEqual(["boundaries/dependencies"]);
  });

  it("DEV-001 AC-6: глибокий імпорт у slice повз index.ts → boundaries/dependencies", async () => {
    expect(await ruleIdsOf("src/widgets/sample/deepImport.ts")).toEqual(["boundaries/dependencies"]);
  });

  it("DEV-001 AC-6: any → @typescript-eslint/no-explicit-any", async () => {
    expect(await ruleIdsOf("src/features/sample/explicitAny.ts")).toEqual([
      "@typescript-eslint/no-explicit-any",
    ]);
  });

  it("DEV-001 AC-6: as string → @typescript-eslint/consistent-type-assertions", async () => {
    expect(await ruleIdsOf("src/features/sample/typeAssertion.ts")).toEqual([
      "@typescript-eslint/consistent-type-assertions",
    ]);
  });

  it("DEV-001 AC-6: файл поза шарами (src/stray.ts) → boundaries/no-unknown-files", async () => {
    expect(await ruleIdsOf("src/stray.ts")).toEqual(["boundaries/no-unknown-files"]);
  });

  it("DEV-001 AC-6: чиста фікстура (as const, імпорт через index.ts) без помилок", async () => {
    const cleanFixture = "src/features/sample/Clean.tsx";
    expect(await eslint.isPathIgnored(path.join(FIXTURES, cleanFixture))).toBe(false);
    expect(await lintFixture(cleanFixture)).toEqual([]);
  });
});
