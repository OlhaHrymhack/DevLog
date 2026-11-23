import "server-only";
import type { z } from "zod";
import type { AgentContext } from "./types";

export type ValidationOutcome<T> = { ok: true; data: T } | { ok: false; violations: string[] };

/** Zod `resultSchema` + `factCheck`. Ті самі перевірки проходить і резервний результат. */
export const validateResult = <Result extends z.ZodType>(
  schema: Result,
  factCheck: (result: z.infer<Result>, ctx: AgentContext) => string[],
  raw: unknown,
  ctx: AgentContext,
): ValidationOutcome<z.infer<Result>> => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      violations: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    };
  }
  const violations = factCheck(parsed.data, ctx);
  return violations.length > 0 ? { ok: false, violations } : { ok: true, data: parsed.data };
};

/** Аргументи tool-виклику приходять рядком JSON; невалідний JSON — окрема помилка для `tool_result`. */
export const parseToolArguments = (raw: string): { ok: true; value: unknown } | { ok: false; error: string } => {
  try {
    const value: unknown = raw.trim() === "" ? {} : JSON.parse(raw);
    return { ok: true, value };
  } catch {
    return { ok: false, error: "Аргументи tool-виклику — невалідний JSON" };
  }
};
