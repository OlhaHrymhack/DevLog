import { describe, expect, it, vi } from "vitest";
import { isConfirmed, summarizeSmokeEvents } from "./smokeSummary";
import { runSmokeCli, SMOKE_EXIT } from "./runSmokeCli";

const SECRET_MARKER = "dl-secret-task-text-77aa";

const ndjson = (...events: unknown[]) => new Response(events.map((event) => JSON.stringify(event)).join("\n") + "\n", {
  status: 200, headers: { "Content-Type": "application/x-ndjson" },
});

const RUN = { type: "run", runId: "r1", mode: "live", steps: [{ label: "Прочитати задачі" }, { label: "Перевірити результат" }] };
const SUCCESS = [
  RUN,
  { type: "step", index: 0, label: "Прочитати задачі", state: "done" },
  { type: "step", index: 1, label: "Перевірити результат", state: "done" },
  { type: "result", status: "result", data: { taskId: "t1", summary: SECRET_MARKER } },
];

const TOKEN = "dl-test-smoke-token-d92e";

const harness = (answer: string, fetchImpl: typeof fetch, port = "3100") => {
  const printed: string[] = [];
  const confirm = vi.fn(async () => answer);
  const run = () => runSmokeCli({ confirm, fetchImpl, print: (line) => printed.push(line), port, token: () => TOKEN });
  return { printed, confirm, run };
};

describe("smoke CLI", () => {
  it("DEV-015 AC-7: isConfirmed приймає лише yes (без урахування регістру й пробілів)", () => {
    expect(isConfirmed("yes")).toBe(true);
    expect(isConfirmed("  YES \n")).toBe(true);
    for (const answer of ["", "y", "так", "no", "yes please"]) expect(isConfirmed(answer)).toBe(false);
  });

  it("DEV-015 AC-7: без підтвердження запит не надсилається", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const { run, printed } = harness("no", fetchImpl);
    expect(await run()).toBe(SMOKE_EXIT.failed);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(printed.join("\n")).toContain("запит не надсилався");
  });

  it("DEV-015 AC-7: сервер недоступний → код 2 із підказкою", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new TypeError("fetch failed"); });
    const { run, printed } = harness("yes", fetchImpl);
    expect(await run()).toBe(SMOKE_EXIT.unreachable);
    expect(SMOKE_EXIT.unreachable).toBe(2);
    expect(printed.join("\n")).toContain("3100");
  });

  it("DEV-015 AC-7: успіх → код 0, друкуються лише метрики без результату агента", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ndjson(...SUCCESS));
    const { run, printed } = harness("yes", fetchImpl);
    expect(await run()).toBe(SMOKE_EXIT.ok);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://localhost:3100/api/dev/agent-smoke");
    expect(init).toMatchObject({ method: "POST", body: "{}" });
    const output = printed.join("\n");
    expect(JSON.parse(output)).toEqual({ final: "result", steps: ["done", "done"] });
    expect(output).not.toContain(SECRET_MARKER);
  });

  it("DEV-015 AC-7: помилка маршруту → код 1 з HTTP-статусом і кодом, без тіла", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ error: { code: "AI_NOT_LIVE", message: SECRET_MARKER } }, { status: 409 }));
    const { run, printed } = harness("yes", fetchImpl);
    expect(await run()).toBe(SMOKE_EXIT.failed);
    expect(printed.join("\n")).toBe("HTTP 409: AI_NOT_LIVE");
  });

  it("DEV-015 AC-7: fallback → код 1 з причиною; сміттєвий потік → код 1", async () => {
    const fallback = vi.fn<typeof fetch>(async () => ndjson(RUN, { type: "fallback", reason: "Агент не вклався в ліміт кроків", data: { taskId: "t1", summary: SECRET_MARKER } }));
    const first = harness("yes", fallback);
    expect(await first.run()).toBe(SMOKE_EXIT.failed);
    expect(first.printed.join("\n")).toContain("Агент не вклався в ліміт кроків");
    expect(first.printed.join("\n")).not.toContain(SECRET_MARKER);

    const garbage = vi.fn<typeof fetch>(async () => new Response("не json\n", { status: 200 }));
    const second = harness("yes", garbage);
    expect(await second.run()).toBe(SMOKE_EXIT.failed);
  });

  it("DEV-015 AC-7: токен іде в заголовку, а некоректний PORT відхиляється до будь-якого запиту", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ndjson(...SUCCESS));
    await harness("yes", fetchImpl).run();
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get("x-smoke-token")).toBe(TOKEN);

    for (const port of ["80@evil.example", "0", "70000", "abc", ""]) {
      const blocked = vi.fn<typeof fetch>();
      const { run, confirm, printed } = harness("yes", blocked, port);
      expect(await run()).toBe(SMOKE_EXIT.failed);
      expect(blocked).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
      expect(printed.join("\n")).toContain("PORT");
    }
  });

  it("DEV-015 AC-7: помилка читання токена → код 1 з окремим повідомленням, запит не надсилається", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const printed: string[] = [];
    const code = await runSmokeCli({
      confirm: async () => "yes", fetchImpl, print: (line) => printed.push(line), port: "3100",
      token: () => { throw new Error("Файл токена smoke пошкоджений"); },
    });
    expect(code).toBe(SMOKE_EXIT.failed);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(printed.join("\n")).toContain("пошкоджений");
    expect(printed.join("\n")).not.toContain("недоступний");
  });

  it("DEV-015 AC-7: summarizeSmokeEvents без фінальної події → final none", () => {
    expect(summarizeSmokeEvents([])).toEqual({ final: "none", steps: [] });
  });
});
