import { describe, expect, it } from "vitest";
import { NOTE_EMPTY_MESSAGE, NOTE_TOO_LONG_MESSAGE, validateNote } from "./validateNote";

describe("validateNote", () => {
  it("DEV-007 AC-4: порожня й пробільна нотатка → «Нотатка порожня»", () => {
    expect(validateNote("")).toEqual({ ok: false, message: NOTE_EMPTY_MESSAGE });
    expect(validateNote("   \n ")).toEqual({ ok: false, message: NOTE_EMPTY_MESSAGE });
  });

  it("DEV-007 AC-4: валідна нотатка обрізає пробіли", () => {
    expect(validateNote("  Зроблено PR  ")).toEqual({ ok: true, text: "Зроблено PR" });
  });

  it("DEV-007 AC-4: задовга нотатка має окреме повідомлення", () => {
    expect(validateNote("а".repeat(2001))).toEqual({ ok: false, message: NOTE_TOO_LONG_MESSAGE });
  });
});
