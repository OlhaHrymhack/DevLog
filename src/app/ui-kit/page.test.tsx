import { afterEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({ notFound }));

import UiKitPage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe("/ui-kit page", () => {
  it("DEV-002 AC-6: у production сторінка викликає notFound() (404)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => UiKitPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("DEV-002 AC-6: у dev сторінка віддає каталог без notFound()", () => {
    vi.stubEnv("NODE_ENV", "development");
    const element = UiKitPage();
    expect(element).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
