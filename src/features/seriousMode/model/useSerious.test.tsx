import { renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
  vi.resetModules();
});

it("DEV-005 AC-10: production ignores the saved serious mode", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.resetModules();
  localStorage.setItem("devlog-serious", "true");
  const { useSerious } = await import("./useSerious");
  expect(renderHook(useSerious).result.current).toBe(false);
});
