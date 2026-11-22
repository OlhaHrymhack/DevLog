import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("DEV-005 AC-11: prototype states panel is absent in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.resetModules();
  const { DevStatesPanel } = await import(".");
  const noop = () => undefined;
  render(<DevStatesPanel open onOpenChange={noop} screen="real" onScreenChange={noop}
    mode="auto" onModeChange={noop} serious={false} onSeriousChange={noop}
    invalidOutput={false} onInvalidOutputChange={noop}
  />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
