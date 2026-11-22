import { z } from "zod";
import { AgentEventSchema, type AgentEvent } from "@/entities/agentRun";
import { readNdjson } from "@/shared/lib/readNdjson";
import { isConfirmed, summarizeSmokeEvents } from "./smokeSummary";
import { SMOKE_TOKEN_HEADER } from "./smokeToken";

export const SMOKE_EXIT = { ok: 0, failed: 1, unreachable: 2 } as const;
const REQUEST_TIMEOUT_MS = 60_000;

const ErrorBodySchema = z.object({ error: z.object({ code: z.string() }) });
const PortSchema = z.coerce.number().int().min(1).max(65535);

export type SmokeCliDeps = {
  confirm: (question: string) => Promise<string>;
  fetchImpl: typeof fetch;
  print: (line: string) => void;
  port: string;
  /** Локальний секрет із `data/`; без нього маршрут відповість 403. */
  token: () => string;
};

/** Платний smoke через localhost: без підтвердження запиту немає, друкуються лише метрики. */
export const runSmokeCli = async ({ confirm, fetchImpl, print, port, token }: SmokeCliDeps): Promise<number> => {
  const parsedPort = /^\d{1,5}$/.test(port) ? PortSchema.safeParse(port) : null;
  if (!parsedPort?.success) {
    print("Некоректний PORT: потрібне ціле число 1–65535.");
    return SMOKE_EXIT.failed;
  }

  const answer = await confirm("Це платний запит до OpenAI: до 4 викликів, до 400 output-токенів кожен; вхідні токени (список задач) теж тарифікуються. Введіть yes для підтвердження: ");
  if (!isConfirmed(answer)) {
    print("Скасовано: запит не надсилався.");
    return SMOKE_EXIT.failed;
  }

  let smokeToken: string;
  try {
    smokeToken = token();
  } catch (error) {
    print(error instanceof Error ? error.message : "Не вдалося прочитати токен smoke.");
    return SMOKE_EXIT.failed;
  }

  let response: Response;
  try {
    response = await fetchImpl(`http://localhost:${parsedPort.data}/api/dev/agent-smoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [SMOKE_TOKEN_HEADER]: smokeToken },
      body: "{}",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    print(`Сервер недоступний на порту ${parsedPort.data}. Запустіть dev-сервер із увімкненим AI_SMOKE і повторіть.`);
    return SMOKE_EXIT.unreachable;
  }

  if (!response.ok || !response.body) {
    const parsed = ErrorBodySchema.safeParse(await response.json().catch(() => null));
    print(`HTTP ${response.status}${parsed.success ? `: ${parsed.data.error.code}` : ""}`);
    return SMOKE_EXIT.failed;
  }

  const events: AgentEvent[] = [];
  try {
    await readNdjson(response.body, (value) => events.push(AgentEventSchema.parse(value)));
  } catch {
    print("Потік відповіді невалідний.");
    return SMOKE_EXIT.failed;
  }

  const summary = summarizeSmokeEvents(events);
  print(JSON.stringify(summary, null, 2));
  return summary.final === "result" ? SMOKE_EXIT.ok : SMOKE_EXIT.failed;
};
