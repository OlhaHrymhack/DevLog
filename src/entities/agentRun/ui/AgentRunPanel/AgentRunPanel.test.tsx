import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDLE_AGENT_RUN, type AgentRunState } from "../../model/agentRunState";
import { AgentRunPanel } from ".";

afterEach(cleanup);

const RUNNING: AgentRunState = {
  ...IDLE_AGENT_RUN, status: "running", runId: "run-1", mode: "demo", startedAt: 1_000,
  steps: [
    { label: "Зібрати задачі", state: "done" },
    { label: "Зважити", state: "run" },
    { label: "Перевірити результат", state: "pending" },
    { label: "Сформувати", state: "pending" },
  ],
};

const DONE: AgentRunState = {
  ...RUNNING, status: "result", finishedAt: 3_300, data: {},
  steps: RUNNING.steps.map((step) => ({ ...step, state: "done" })),
};

const renderPanel = (run: AgentRunState, onStop = vi.fn()) => render(
  <AgentRunPanel title="План на день" icon={null} tagLabel="Агент A" run={run} onStop={onStop} idle={<button type="button">Запустити</button>}>
    <p>Результат агента</p>
  </AgentRunPanel>,
);

describe("AgentRunPanel", () => {
  it("DEV-008 AC-11: running — прогрес, кроки й кнопка «Зупинити»", () => {
    const onStop = vi.fn();
    renderPanel(RUNNING, onStop);
    expect(screen.getByRole("progressbar", { name: "Прогрес агента" }).getAttribute("aria-valuenow")).toBe("25");
    expect(screen.getAllByRole("listitem").map((item) => item.getAttribute("data-state"))).toEqual(["done", "run", "pending", "pending"]);
    fireEvent.click(screen.getByRole("button", { name: "Зупинити" }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Результат агента")).toBeNull();
    expect(screen.queryByText("Запустити")).toBeNull();
  });

  it("DEV-008 AC-11: demo — тег «Демо · Агент A» і «мок-відповідь» у підсумковому рядку", () => {
    renderPanel(DONE);
    expect(screen.getByText("Демо · Агент A")).toBeTruthy();
    expect(screen.getByTestId("agent-run-summary").textContent).toBe("4 кроки · 2,3 с · мок-відповідь");
    expect(screen.getByText("Результат агента")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Зупинити" })).toBeNull();
  });

  it("DEV-008 AC-11: live — без демо-тега і без «мок-відповідь»", () => {
    renderPanel({ ...DONE, mode: "live" });
    expect(screen.queryByText(/Демо ·/)).toBeNull();
    expect(screen.getByTestId("agent-run-summary").textContent).not.toContain("мок-відповідь");
  });

  it("DEV-008 AC-11: idle показує вміст запуску; fallback — alert із причиною", () => {
    const { rerender } = renderPanel(IDLE_AGENT_RUN);
    expect(screen.getByText("Запустити")).toBeTruthy();
    rerender(
      <AgentRunPanel title="План на день" icon={null} tagLabel="Агент A" onStop={vi.fn()}
        run={{ ...DONE, status: "fallback", fallbackReason: "Результат не пройшов перевірку двічі" }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Результат не пройшов перевірку двічі");
  });
});
