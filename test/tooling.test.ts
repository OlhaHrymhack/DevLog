import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const ROOT = path.resolve(__dirname, "..");

const packageJsonSchema = z.object({
  scripts: z.record(z.string(), z.string()),
});

function readScripts() {
  const raw: unknown = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return packageJsonSchema.parse(raw).scripts;
}

describe("npm scripts", () => {
  it("DEV-001 AC-2: package.json містить скрипти dev/build/start/lint/typecheck/test/test:e2e/prepare", () => {
    expect(readScripts()).toMatchObject({
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "eslint .",
      typecheck: "tsc --noEmit",
      test: "vitest run",
      "test:e2e": "playwright test",
      prepare: expect.stringContaining("git config core.hooksPath .githooks"),
    });
  });

  it("DEV-001 AC-2: prepare не падає поза git-репозиторієм", () => {
    const prepare = readScripts().prepare ?? "";
    expect(prepare).not.toBe("");
    const outsideGit = mkdtempSync(path.join(tmpdir(), "devlog-prepare-"));
    try {
      const childEnv: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_CEILING_DIRECTORIES: path.dirname(outsideGit),
        GIT_DIR: undefined,
        GIT_WORK_TREE: undefined,
      };
      expect(() => execSync(prepare, { cwd: outsideGit, env: childEnv, stdio: "pipe" })).not.toThrow();
    } finally {
      rmSync(outsideGit, { recursive: true, force: true });
    }
  });
});
