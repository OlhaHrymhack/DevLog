import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const APP_CODE_DIRECTORIES = [SRC, path.join(ROOT, "test"), path.join(ROOT, "e2e")];
const ROOT_CONFIGS = ["eslint.config.mjs", "next.config.ts", "playwright.config.ts", "vitest.config.mts"].map((name) => path.join(ROOT, name));
const SHARED_UI = path.join(SRC, "shared/ui");

const listFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });

const relative = (file: string) => path.relative(ROOT, file);

const isSourceFile = (file: string) => /\.tsx?$/.test(file);

const functionDeclarationsIn = (file: string): string[] => {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${relative(file)}:${line + 1} ${node.name?.text ?? "(anonymous)"}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
};

describe("Конвенції коду", () => {
  it("DEV-014 AC-5: у src, test, e2e і кореневих конфігах немає function declaration (лише стрілкові const)", () => {
    const files = [...APP_CODE_DIRECTORIES.flatMap(listFiles), ...ROOT_CONFIGS].filter((file) => /\.(tsx?|mts|mjs)$/.test(file));
    const declarations = files.flatMap(functionDeclarationsIn);
    expect(declarations).toEqual([]);
  });

  it("DEV-014 AC-5: кожен компонент shared/ui лежить у PascalCase-папці з index.tsx", () => {
    const entries = fs.readdirSync(SHARED_UI, { withFileTypes: true });

    const flatComponents = entries.filter((entry) => entry.isFile() && /\.tsx$/.test(entry.name) && !entry.name.endsWith(".test.tsx"));
    expect(flatComponents.map((entry) => entry.name)).toEqual([]);

    const folders = entries.filter((entry) => entry.isDirectory());
    expect(folders.length).toBeGreaterThan(0);
    for (const folder of folders) {
      expect(folder.name, `папка ${folder.name} має бути в PascalCase`).toMatch(/^[A-Z][A-Za-z0-9]*$/);
      expect(fs.existsSync(path.join(SHARED_UI, folder.name, "index.tsx")), `${folder.name}/index.tsx`).toBe(true);
    }
  });

  it("DEV-014 AC-5: хуки в shared/lib/hooks називаються з префікса use", () => {
    const hookFiles = fs.readdirSync(path.join(SRC, "shared/lib/hooks")).filter((name) => isSourceFile(name) && !name.includes(".test."));
    expect(hookFiles.length).toBeGreaterThan(0);
    for (const name of hookFiles) {
      expect(name, `${name} має починатися з use`).toMatch(/^use[A-Z]/);
    }
  });
});
