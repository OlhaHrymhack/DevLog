import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DayPlanPanel } from "./index";

const NOW = "2026-11-21T12:00:00.000Z";

const task = (id: string, title: string, overrides: Record<string, unknown> = {}) => ({
  id, title, description: "Опис задачі для тесту", status: "todo", priority: "high", createdAt: NOW, updatedAt: NOW, dueAt: null,
  focusRank: null, subtaskCount: 0, subtaskDone: 0, ...overrides,
});

const TASKS = [task("t1", "Виправити витік пам’яті"), task("t2", "Міграція auth на нові токени"), task("t7", "Оновити Next.js")];
const WHY = "Високий пріоритет, 5 днів без змін.";
const STEPS = ["Зібрати активні задачі", "Зважити пріоритет, вік, статус і дедлайни", "Скласти порядок і пояснення", "Перевірити відповідь (схема, існування задач)"];

const ndjson = (...events: unknown[]) => events.map((event) => JSON.stringify(event)).join("\n") + "\n";
const stepEvents = STEPS.map((label, index) => ({ type: "step", index, label, state: "done" }));
const RUN = { type: "run", runId: "r1", mode: "demo", steps: STEPS.map((label) => ({ label })) };

const RESULT_STREAM = ndjson(RUN, ...stepEvents, {
  type: "result", status: "result",
  data: {
    items: [
      { taskId: "t2", why: WHY, joke: "Жарт про дедлайн" },
      { taskId: "t1", why: WHY, joke: null },
      { taskId: "t7", why: WHY, joke: null },
    ],
    deferred: [],
  },
});

const FALLBACK_STREAM = ndjson(RUN, ...stepEvents.slice(0, 3), { type: "step", index: 3, label: "Перевірка не пройдена", state: "fail" }, {
  type: "fallback", reason: "Результат не пройшов перевірку двічі",
  data: { items: [
    { taskId: "t2", why: "Порядок за простим правилом: пріоритет, вік, статус.", joke: null },
    { taskId: "t7", why: "Порядок за простим правилом: пріоритет, вік, статус.", joke: null },
    { taskId: "t1", why: "Порядок за простим правилом: пріоритет, вік, статус.", joke: null },
  ], deferred: [] },
});

type Scenario = { tasks?: unknown[]; listStatus?: number; stream?: string };

const stubApi = ({ tasks = TASKS, listStatus = 200, stream = RESULT_STREAM }: Scenario = {}) => {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    if (url.startsWith("/api/agents/prioritize")) return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
    if (method === "PUT" && url === "/api/tasks/focus") return Response.json({ data: [] });
    if (listStatus !== 200) return Response.json({ error: { code: "INTERNAL_ERROR", message: "boom" } }, { status: listStatus });
    return Response.json({ data: tasks });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
};

const renderPanel = (props: { serious?: boolean } = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}><DayPlanPanel serious={props.serious ?? false} demo /></QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.stubGlobal("scrollTo", () => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const runPlan = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /Скласти план на день/ }));
  await screen.findByRole("list", { name: "План на день" });
};

describe("панель «План на день»", () => {
  it("DEV-009 AC-5: запуск → кроки → план із поясненнями → діалог «Скасувати» нічого не записує", async () => {
    const calls = stubApi();
    renderPanel();
    await runPlan();

    const plan = screen.getByRole("list", { name: "План на день" });
    expect(within(plan).getAllByRole("listitem")).toHaveLength(3);
    expect(within(plan).getAllByText(WHY)).toHaveLength(3);
    expect(screen.getByText("Це пропозиція: фокус дня зміниться лише після підтвердження.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Застосувати порядок" }));
    const dialog = await screen.findByRole("dialog", { name: "Закріпити фокус дня?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Скасувати" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
    expect(screen.getByRole("list", { name: "План на день" })).toBeTruthy();
  });

  it("DEV-009 AC-5: «Закріпити» → PUT /api/tasks/focus у порядку плану → панель повертається в очікування", async () => {
    const calls = stubApi();
    renderPanel();
    await runPlan();

    fireEvent.click(screen.getByRole("button", { name: "Застосувати порядок" }));
    const dialog = await screen.findByRole("dialog", { name: "Закріпити фокус дня?" });
    expect(within(dialog).getByText(/Статуси й пріоритети не зміняться/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Закріпити" }));

    await waitFor(() => expect(calls.find((call) => call.method === "PUT")?.body).toEqual({ taskIds: ["t2", "t1", "t7"] }));
    expect(await screen.findByRole("button", { name: /Скласти план на день/ })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "План на день" })).toBeNull();
  });

  it("DEV-009 AC-5: закріплений фокус показується в очікуванні як «Фокус дня закріплено: 1. … · 2. …»", async () => {
    stubApi({ tasks: [task("t2", "Міграція auth", { focusRank: 1 }), task("t1", "Витік пам’яті", { focusRank: 2 }), task("t7", "Next.js")] });
    renderPanel();
    expect(await screen.findByText(/Фокус дня закріплено:/)).toBeTruthy();
    expect(screen.getByText(/1\. Міграція auth · 2\. Витік пам’яті/)).toBeTruthy();
  });

  it("DEV-009 AC-4: fallback → червоний alert, порядок без пояснень, «Взяти цей порядок» → діалог правила", async () => {
    const calls = stubApi({ stream: FALLBACK_STREAM });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Скласти план на день/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Відповідь агента відхилено.");
    expect(alert.textContent).toContain("Вона не пройшла перевірку двічі, тому не показуємо її.");
    expect(screen.getByText(/Без пояснень від AI/)).toBeTruthy();
    expect(screen.queryByText(/Порядок за простим правилом: пріоритет, вік, статус\./)).toBeNull();
    expect(screen.getByRole("button", { name: "Спробувати ще раз" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Взяти цей порядок" }));
    const dialog = await screen.findByRole("dialog", { name: "Закріпити порядок за правилом?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Закріпити" }));
    await waitFor(() => expect(calls.find((call) => call.method === "PUT")?.body).toEqual({ taskIds: ["t2", "t7", "t1"] }));
  });

  it("DEV-009 AC-6: лише done-задачі → «Немає активних задач для аналізу», кнопки запуску немає", async () => {
    stubApi({ tasks: [task("t5", "Бекапи", { status: "done" })] });
    renderPanel();
    expect(await screen.findByText(/Немає активних задач для аналізу\./)).toBeTruthy();
    expect(screen.getByText(/Підозріло спокійно/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Скласти план на день/ })).toBeNull();
  });

  it("DEV-009 AC-6: список не завантажився → «Агенту немає з чим працювати», без кнопки запуску", async () => {
    stubApi({ listStatus: 500 });
    renderPanel();
    expect(await screen.findByText("Агенту немає з чим працювати: список задач не завантажився.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Скласти план на день/ })).toBeNull();
  });

  it("DEV-009 AC-7: «Перегенерувати план» запускає новий запуск, «Відхилити» → тост і очікування", async () => {
    const calls = stubApi();
    renderPanel();
    await runPlan();
    const runsBefore = calls.filter((call) => call.url.startsWith("/api/agents/prioritize")).length;

    fireEvent.click(screen.getByRole("button", { name: "Перегенерувати план" }));
    await waitFor(() => expect(calls.filter((call) => call.url.startsWith("/api/agents/prioritize")).length).toBe(runsBefore + 1));
    await screen.findByRole("list", { name: "План на день" });

    fireEvent.click(screen.getByRole("button", { name: "Відхилити" }));
    expect(await screen.findByRole("button", { name: /Скласти план на день/ })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "План на день" })).toBeNull();
  });

  it("DEV-009 AC-7: «Зупинити» під час запуску повертає панель в очікування", async () => {
    stubApi();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/agents/prioritize")) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        });
      }
      return Promise.resolve(Response.json({ data: TASKS }));
    }));
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Скласти план на день/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Зупинити" }));
    expect(await screen.findByRole("button", { name: /Скласти план на день/ })).toBeTruthy();
  });

  it("DEV-009 AC-8: у серйозному режимі жарт агента не показується й немає емодзі; поза ним жарт видно", async () => {
    stubApi();
    const serious = renderPanel({ serious: true });
    await runPlan();
    expect(screen.queryByText("Жарт про дедлайн")).toBeNull();
    serious.unmount();

    stubApi({ tasks: [task("t5", "Бекапи", { status: "done" })] });
    const done = renderPanel({ serious: true });
    expect((await screen.findByText(/Немає активних задач/)).textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    done.unmount();

    stubApi();
    renderPanel({ serious: false });
    await runPlan();
    expect(screen.getByText("Жарт про дедлайн")).toBeTruthy();
  });
});
