import { randomBytes, timingSafeEqual } from "node:crypto";
import { closeSync, constants, fstatSync, linkSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const SMOKE_TOKEN_HEADER = "x-smoke-token";

const TOKEN_FORMAT = /^[0-9a-f]{64}$/;
const UNSAFE_FILE_MESSAGE = "Файл токена smoke має бути звичайним, з правами 0600 і вашим власником; видаліть його, щоб створити новий";

/** Лежить у `data/` під шаблоном `data/*.db*` з .gitignore, тож у репозиторій не потрапляє. */
export const smokeTokenPath = (cwd: string = process.cwd()): string => join(cwd, "data", "smoke-token.db-secret");

const isErrnoCode = (error: unknown, code: string): boolean => error instanceof Error && "code" in error && error.code === code;

/**
 * Атомарне створення: повний вміст пишемо у тимчасовий файл і «прив'язуємо» його до шляху через `link`
 * (EEXIST, якщо файл уже є). Так інший процес ніколи не прочитає порожній напівзаписаний файл.
 */
const createTokenFile = (path: string) => {
  const temporary = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(temporary, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  try {
    linkSync(temporary, path);
  } catch (error) {
    if (!isErrnoCode(error, "EEXIST")) throw error;
  } finally {
    rmSync(temporary, { force: true });
  }
};

/** Відкриває без переходу за symlink і перевіряє властивості того самого дескриптора, що й читає. */
const readPrivateFile = (path: string): string => {
  let descriptor: number;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw new Error(UNSAFE_FILE_MESSAGE);
  }
  try {
    const stat = fstatSync(descriptor);
    const ownedByUs = typeof process.getuid !== "function" || stat.uid === process.getuid();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || !ownedByUs) throw new Error(UNSAFE_FILE_MESSAGE);
    return readFileSync(descriptor, "utf8").trim();
  } finally {
    closeSync(descriptor);
  }
};

/**
 * Локальний секрет проти запитів із мережі й DNS rebinding: його може прочитати лише процес із доступом
 * до файлової системи розробника (маршрут і CLI). Створюється при першому зверненні (права 0600).
 * Токен не змінюється між запусками; щоб перегенерувати його, видаліть файл.
 * Перевірка прав розрахована на macOS/Linux; на Windows smoke не підтримується.
 */
export const ensureSmokeToken = (path: string = smokeTokenPath()): string => {
  mkdirSync(dirname(path), { recursive: true });
  createTokenFile(path);
  const token = readPrivateFile(path);
  if (!TOKEN_FORMAT.test(token)) throw new Error("Файл токена smoke пошкоджений; видаліть його, щоб створити новий");
  return token;
};

/** Приймає лише токени очікуваного формату з обох боків: порожній чи нестандартний рядок не пропускає нічого. */
export const isValidSmokeToken = (provided: string | null, expected: string): boolean => {
  if (provided === null || !TOKEN_FORMAT.test(provided) || !TOKEN_FORMAT.test(expected)) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
};
