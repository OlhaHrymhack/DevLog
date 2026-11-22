import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HEAT_LEVELS } from "../model/heatLevels";
import { HeatBadge } from "./HeatBadge";
import { PriorityLabel } from "./PriorityLabel";
import { StatusBadge } from "./StatusBadge";
import { TaskRow } from "./TaskRow";
import type { TaskRowData } from "./TaskRow/types";

afterEach(cleanup);

const NOW = Date.UTC(2026, 10, 21, 12, 0);
const DAY = 86_400_000;

const makeTask = (overrides: Partial<TaskRowData> = {}): TaskRowData => {
  return {
    id: "t1",
    title: "Виправити витік пам’яті",
    description: "RSS воркера росте на 40 МБ/год.",
    status: "in-progress",
    priority: "high",
    createdAt: NOW - 6 * DAY,
    updatedAt: NOW - 5 * DAY,
    ...overrides,
  };
};

describe("StatusBadge і PriorityLabel", () => {
  it("DEV-002 AC-5: StatusBadge рендерить три підписи статусів", () => {
    render(
      <>
        <StatusBadge status="todo" />
        <StatusBadge status="in-progress" />
        <StatusBadge status="done" />
      </>,
    );
    expect(screen.getByText("До роботи")).toBeTruthy();
    expect(screen.getByText("В роботі")).toBeTruthy();
    expect(screen.getByText("Готово")).toBeTruthy();
  });

  it("DEV-002 AC-5: PriorityLabel рендерить підписи пріоритетів", () => {
    render(
      <>
        <PriorityLabel priority="high" />
        <PriorityLabel priority="medium" />
        <PriorityLabel priority="low" />
      </>,
    );
    expect(screen.getByText("Високий")).toBeTruthy();
    expect(screen.getByText("Середній")).toBeTruthy();
    expect(screen.getByText("Низький")).toBeTruthy();
  });
});

describe("HeatBadge", () => {
  it("DEV-002 AC-5: HeatBadge має aria-label «Температура: <назва>. <розшифровка>»", () => {
    render(<HeatBadge level={HEAT_LEVELS.hot} />);
    const button = screen.getByRole("button", { name: `Температура: ${HEAT_LEVELS.hot.name}. ${HEAT_LEVELS.hot.meaning}` });
    expect(button).toBeTruthy();
  });

  it("DEV-002 AC-5: tooltip HeatBadge відкривається по фокусу й показує жарт", () => {
    render(<HeatBadge level={HEAT_LEVELS.hot} />);
    expect(screen.queryByRole("tooltip")).toBeNull();

    act(() => screen.getByRole("button").focus());

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain(HEAT_LEVELS.hot.meaning);
    expect(tooltip.textContent).toContain(HEAT_LEVELS.hot.joke);
  });

  it("DEV-002 AC-5: у серйозному режимі tooltip без жарту", () => {
    render(<HeatBadge level={HEAT_LEVELS.hot} serious />);
    act(() => screen.getByRole("button").focus());
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain(HEAT_LEVELS.hot.meaning);
    expect(tooltip.textContent).not.toContain(HEAT_LEVELS.hot.joke);
  });

  it("DEV-002 AC-5: тап перемикає tooltip (тач без hover/focus)", () => {
    render(<HeatBadge level={HEAT_LEVELS.fire} />);
    const button = screen.getByRole("button");

    fireEvent.pointerDown(button);
    fireEvent.click(button);
    expect(screen.getByRole("tooltip").textContent).toContain(HEAT_LEVELS.fire.name);

    fireEvent.pointerDown(button);
    fireEvent.click(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("DEV-002 AC-5: рівні з show:false приховані, доки не передано always", () => {
    const { container, rerender } = render(<HeatBadge level={HEAT_LEVELS.fresh} />);
    expect(container.querySelector("button")).toBeNull();

    rerender(<HeatBadge level={HEAT_LEVELS.fresh} always />);
    expect(container.querySelector("button")).not.toBeNull();
  });
});

describe("TaskRow", () => {
  it("DEV-002 AC-5: TaskRow показує назву-посилання, вік, температуру й позначку фокусу", () => {
    render(<TaskRow task={makeTask()} now={NOW} focusRank={2} onEdit={vi.fn()} onDelete={vi.fn()} />);

    const link = screen.getByRole("link", { name: "Виправити витік пам’яті" });
    expect(link.getAttribute("href")).toBe("/tasks/t1");
    expect(screen.getByText("6 днів")).toBeTruthy();
    expect(screen.getByText("Фокус #2")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Температура: Гаряча/ })).toBeTruthy();
  });

  it("DEV-002 AC-5: кнопки-іконки TaskRow мають aria-label і викликають колбеки з задачею", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const task = makeTask();
    render(<TaskRow task={task} now={NOW} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: `Редагувати: ${task.title}` }));
    fireEvent.click(screen.getByRole("button", { name: `Видалити: ${task.title}` }));

    expect(onEdit).toHaveBeenCalledWith(task);
    expect(onDelete).toHaveBeenCalledWith(task);
  });

  it("DEV-002 AC-5: done — закреслена назва; alarm — рядок позначено рівнем alarm", () => {
    const { container, rerender } = render(<TaskRow task={makeTask({ status: "done" })} now={NOW} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("link").className).toContain("line-through");
    expect(container.querySelector("[data-slot=task-row]")?.getAttribute("data-heat")).toBe("done");

    rerender(<TaskRow task={makeTask({ dueAt: NOW + 20 * 3_600_000 })} now={NOW} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(container.querySelector("[data-slot=task-row]")?.getAttribute("data-heat")).toBe("alarm");
  });

  it("DEV-002 AC-5: без focusRank позначки фокусу немає", () => {
    render(<TaskRow task={makeTask()} now={NOW} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText(/^Фокус #/)).toBeNull();
  });
});
