import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentStep } from "../model/types";
import { AgentFallbackAlert } from "./AgentFallbackAlert";
import { AgentPanel } from "./AgentPanel";
import { AgentProgress } from "./AgentProgress";
import { AgentStepList } from "./AgentStepList";
import { AgentTag } from "./AgentTag";

afterEach(cleanup);

const STEPS: readonly AgentStep[] = [
  { label: "Зібрати задачі", state: "done", detail: "Знайдено 9" },
  { label: "Зважити", state: "run" },
  { label: "Порядок", state: "pending" },
  { label: "Перевірка", state: "fail" },
];

describe("AgentStepList", () => {
  it("DEV-002 AC-5: AgentStepList має sr-текст стану кожного кроку", () => {
    render(<AgentStepList steps={STEPS} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-state"))).toEqual(["done", "run", "pending", "fail"]);
    expect(items[0]?.textContent).toContain("— готово");
    expect(items[1]?.textContent).toContain("— виконується");
    expect(items[2]?.textContent).toContain("— очікує");
    expect(items[3]?.textContent).toContain("— помилка");
  });

  it("DEV-002 AC-5: AgentStepList — aria-live polite і detail під кроком", () => {
    render(<AgentStepList steps={STEPS} />);
    expect(screen.getByRole("list").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("Знайдено 9")).toBeTruthy();
  });

  it("DEV-002 AC-5: порожній список кроків нічого не рендерить", () => {
    const { container } = render(<AgentStepList steps={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("AgentProgress", () => {
  it("DEV-002 AC-5: AgentProgress — role=progressbar, % = done / усі кроки", () => {
    render(<AgentProgress steps={[{ label: "a", state: "done" }, { label: "b", state: "done" }, { label: "c", state: "run" }, { label: "d", state: "pending" }]} />);
    const bar = screen.getByRole("progressbar", { name: "Прогрес агента" });
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("DEV-002 AC-5: AgentProgress без кроків = 0%", () => {
    render(<AgentProgress steps={[]} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });
});

describe("AgentTag і AgentFallbackAlert", () => {
  it("DEV-002 AC-5: AgentTag — «Агент A» і жовте «Демо · Агент A»", () => {
    const { rerender } = render(<AgentTag label="Агент A" />);
    expect(screen.getByText("Агент A")).toBeTruthy();
    rerender(<AgentTag label="Агент A" demo />);
    expect(screen.getByText("Демо · Агент A")).toBeTruthy();
  });

  it("DEV-002 AC-5: AgentFallbackAlert — role=alert із заголовком і текстом", () => {
    render(<AgentFallbackAlert title="Агент не зміг відповісти">Показуємо базове правило.</AgentFallbackAlert>);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Агент не зміг відповісти");
    expect(alert.textContent).toContain("Показуємо базове правило.");
  });
});

describe("AgentPanel", () => {
  it("DEV-002 AC-5: AgentPanel із collapsible згортається на вузькому екрані й розгортається кліком", () => {
    render(
      <AgentPanel title="План на день" icon={null} tagLabel="Агент A" collapsible summary="3 задачі застрягли">
        <p>Тіло панелі</p>
      </AgentPanel>,
    );
    const head = screen.getByRole("button", { name: /План на день/ });
    const panel = screen.getByRole("region", { name: "План на день" });

    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(panel.getAttribute("data-open")).toBe("false");
    expect(screen.getByText("3 задачі застрягли")).toBeTruthy();

    fireEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(panel.getAttribute("data-open")).toBe("true");
  });

  it("DEV-002 AC-5: AgentPanel без collapsible — завжди розгорнута, без кнопки-заголовка", () => {
    render(
      <AgentPanel title="Радар" icon={null} tagLabel="Агент D" demo running>
        <p>Тіло</p>
      </AgentPanel>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "Радар" }).getAttribute("data-open")).toBe("true");
    expect(screen.getByText("Демо · Агент D")).toBeTruthy();
  });
});
