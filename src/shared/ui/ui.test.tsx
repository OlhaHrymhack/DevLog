import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../../test/utils/matchMedia";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { ResponsiveDialog } from "./ResponsiveDialog";

afterEach(() => {
  cleanup();
  mockMatchMedia(false);
});

describe("Button", () => {
  it("DEV-002 AC-5: Button має варіанти primary · ghost · danger · danger-ghost · ai", () => {
    render(
      <>
        <Button variant="primary">primary</Button>
        <Button variant="ghost">ghost</Button>
        <Button variant="danger">danger</Button>
        <Button variant="danger-ghost">danger-ghost</Button>
        <Button variant="ai">ai</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "primary" }).className).toContain("bg-primary");
    expect(screen.getByRole("button", { name: "ghost" }).className).toContain("border-border-strong");
    expect(screen.getByRole("button", { name: "danger" }).className).toContain("bg-danger");
    expect(screen.getByRole("button", { name: "danger-ghost" }).className).toContain("text-danger");
    expect(screen.getByRole("button", { name: "ai" }).className).toContain("bg-ai-bg");
  });

  it("DEV-002 AC-5: кнопка-іконка має aria-label як доступну назву", () => {
    render(
      <Button size="icon" aria-label="Редагувати">
        <svg aria-hidden="true" />
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Редагувати" })).toBeTruthy();
  });

  it("DEV-002 AC-5: Button за замовчуванням type=button, disabled блокує клік, asChild рендерить посилання", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button disabled onClick={onClick}>
        Зберегти
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Зберегти" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <Button asChild variant="ghost">
        <a href="/x">Перейти</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Перейти" }).className).toContain("border-border-strong");
  });
});

describe("EmptyState", () => {
  it("DEV-002 AC-5: EmptyState — заголовок, текст, дія; error має role=alert", () => {
    const { rerender } = render(<EmptyState tone="humor" emoji="🧘" title="Нічого не горить" description="Можна видихнути" action={<Button>Нова</Button>} />);
    expect(screen.getByRole("heading", { name: "Нічого не горить" })).toBeTruthy();
    expect(screen.getByText("Можна видихнути")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Нова" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(<EmptyState tone="error" emoji="🔌" title="Не вдалося завантажити" />);
    expect(screen.getByRole("alert").textContent).toContain("Не вдалося завантажити");
  });
});

describe("ResponsiveDialog", () => {
  const renderDialog = (onOpenChange = vi.fn()) => {
    render(
      <ResponsiveDialog open onOpenChange={onOpenChange} title="Видалити задачу?" description="Підзадачі теж буде видалено" actions={<Button>Видалити</Button>}>
        <p>Тіло</p>
      </ResponsiveDialog>,
    );
    return onOpenChange;
  };

  it("DEV-002 AC-5: ≥ 768px — діалог із заголовком, описом і діями", () => {
    mockMatchMedia(true);
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Видалити задачу?" });
    expect(dialog.getAttribute("data-slot")).toBe("dialog-content");
    expect(dialog.textContent).toContain("Підзадачі теж буде видалено");
    expect(screen.getByRole("button", { name: "Видалити" })).toBeTruthy();
  });

  it("DEV-002 AC-5: < 768px — bottom sheet з тими самими діями", () => {
    mockMatchMedia(false);
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Видалити задачу?" });
    expect(dialog.getAttribute("data-slot")).toBe("sheet-content");
    expect(screen.getByRole("button", { name: "Видалити" })).toBeTruthy();
  });

  it("DEV-002 AC-5: Esc закриває діалог", () => {
    mockMatchMedia(true);
    const onOpenChange = renderDialog();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("DEV-002 AC-5: після закриття фокус повертається на елемент, що відкрив діалог", async () => {
    mockMatchMedia(true);
    const Host = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Відкрити
          </button>
          <ResponsiveDialog open={open} onOpenChange={setOpen} title="Діалог">
            <p>Тіло</p>
          </ResponsiveDialog>
        </>
      );
    };
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Відкрити" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
