import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SlackPreview } from "./index";

afterEach(cleanup);

describe("SlackPreview", () => {
  it("DEV-011 AC-8: нотатка з <img onerror> рендериться як текст, елемента img немає", () => {
    const { container } = render(<SlackPreview text={"*Задача*: апдейт\nНотатка: <img src=x onerror=alert(1)>"} typing={false} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("slack-preview-text").textContent).toContain("<img src=x onerror=alert(1)>");
    expect(screen.getByTestId("slack-preview-text").querySelector("strong")?.textContent).toBe("Задача");
  });

  it("DEV-011 AC-7: текст у aria-live=polite, каретка лише під час друку", () => {
    const { container, rerender } = render(<SlackPreview text="Привіт" typing />);
    expect(screen.getByTestId("slack-preview-text").getAttribute("aria-live")).toBe("polite");
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    rerender(<SlackPreview text="Привіт" typing={false} />);
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});
