import { describe, expect, it } from "vitest";
import { clarificationNote, CLARIFICATION_NOTE_PREFIX, CLARIFICATION_TOO_SHORT, validateClarification } from "./clarification";

describe("уточнення для декомпозиції", () => {
  it("DEV-010 AC-3: коротша за 3 символи відповідь відхиляється з повідомленням, пробіли обрізаються", () => {
    expect(validateClarification("  ні ")).toEqual({ ok: false, message: CLARIFICATION_TOO_SHORT });
    expect(validateClarification("  e2e checkout  ")).toEqual({ ok: true, text: "e2e checkout" });
    expect(validateClarification("а".repeat(1001)).ok).toBe(false);
  });

  it("DEV-010 AC-3: нотатка починається з «Уточнення для декомпозиції: »", () => {
    expect(clarificationNote("e2e checkout")).toBe(`${CLARIFICATION_NOTE_PREFIX}e2e checkout`);
    expect(CLARIFICATION_NOTE_PREFIX).toBe("Уточнення для декомпозиції: ");
  });
});
