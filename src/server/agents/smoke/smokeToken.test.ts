import { chmodSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSmokeToken, isValidSmokeToken, smokeTokenPath } from "./smokeToken";

const VALID = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

let directory: string;
let path: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "devlog-smoke-token-"));
  path = join(directory, "data", "token");
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("локальний токен smoke", () => {
  it("DEV-015 AC-4: створюється з правами 0600, довгий, і повторні виклики повертають той самий", () => {
    const first = ensureSmokeToken(path);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(ensureSmokeToken(path)).toBe(first);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("DEV-015 AC-4: існуючий файл не перезаписується, а правильний токен із нього читається", () => {
    ensureSmokeToken(path);
    writeFileSync(path, `${VALID}\n`, { mode: 0o600 });
    expect(ensureSmokeToken(path)).toBe(VALID);
  });

  it("DEV-015 AC-4: порожній або пошкоджений файл → помилка, а не порожній токен", () => {
    ensureSmokeToken(path);
    for (const content of ["", "   \n", "not-a-token"]) {
      writeFileSync(path, content, { mode: 0o600 });
      expect(() => ensureSmokeToken(path)).toThrow(/пошкоджений/);
    }
  });

  it("DEV-015 AC-4: файл із правами для групи/інших або symlink відхиляється", () => {
    ensureSmokeToken(path);
    chmodSync(path, 0o644);
    expect(() => ensureSmokeToken(path)).toThrow(/0600/);

    rmSync(path);
    const target = join(directory, "elsewhere");
    writeFileSync(target, VALID, { mode: 0o600 });
    symlinkSync(target, path);
    expect(() => ensureSmokeToken(path)).toThrow(/0600/);
  });

  it("DEV-015 AC-4: перевірка приймає лише точний збіг токена правильного формату", () => {
    expect(isValidSmokeToken(VALID, VALID)).toBe(true);
    for (const provided of [null, "", VALID.slice(1), `${VALID}0`, VALID.replace("a", "b")]) {
      expect(isValidSmokeToken(provided, VALID)).toBe(false);
    }
  });

  it("DEV-015 AC-4: порожній чи нестандартний очікуваний токен не пропускає нічого", () => {
    expect(isValidSmokeToken("", "")).toBe(false);
    expect(isValidSmokeToken("abc", "abc")).toBe(false);
    expect(isValidSmokeToken(null, "")).toBe(false);
  });

  it("DEV-015 AC-4: 64 символи з не-ASCII не кидають виняток, а відхиляються", () => {
    const nonAscii = `${"é".repeat(32)}${"a".repeat(32)}`;
    expect(nonAscii).toHaveLength(64);
    expect(isValidSmokeToken(nonAscii, VALID)).toBe(false);
  });

  it("DEV-015 AC-4: шлях токена лежить у data/ під шаблоном .gitignore `data/*.db*`", () => {
    expect(smokeTokenPath("/x")).toBe("/x/data/smoke-token.db-secret");
  });
});
