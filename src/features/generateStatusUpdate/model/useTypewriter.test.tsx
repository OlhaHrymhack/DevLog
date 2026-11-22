import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TYPING_CHARS_PER_TICK, TYPING_TICK_MS, useTypewriter } from "./useTypewriter";

const mockReducedMotion = (reduced: boolean) => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"), media: query,
    addEventListener: () => undefined, removeEventListener: () => undefined,
  }));
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useTypewriter", () => {
  it("DEV-011 AC-7: друкує по 3 символи за тік і зупиняється на повному тексті", () => {
    mockReducedMotion(false);
    const { result } = renderHook(() => useTypewriter("Привіт, світе", true));
    expect(result.current).toEqual({ shown: "", typing: true });
    act(() => { vi.advanceTimersByTime(TYPING_TICK_MS); });
    expect(result.current.shown).toBe("Привіт, світе".slice(0, TYPING_CHARS_PER_TICK));
    act(() => { vi.advanceTimersByTime(TYPING_TICK_MS * 10); });
    expect(result.current).toEqual({ shown: "Привіт, світе", typing: false });
  });

  it("DEV-011 AC-7: prefers-reduced-motion або вимкнений друк → текст одразу повністю", () => {
    mockReducedMotion(true);
    expect(renderHook(() => useTypewriter("Привіт", true)).result.current).toEqual({ shown: "Привіт", typing: false });
    mockReducedMotion(false);
    expect(renderHook(() => useTypewriter("Привіт", false)).result.current).toEqual({ shown: "Привіт", typing: false });
  });
});
