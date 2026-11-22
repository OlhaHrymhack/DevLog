import type { z } from "zod";
import { ApiErrorResponseSchema } from "./errors";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const fetchJson = async <T>(
  url: string,
  schema: z.ZodType<T>,
  options?: RequestInit,
): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    throw new ApiError("NETWORK_ERROR", "Не вдалося з’єднатися із сервером");
  }

  const body: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(code, message, response.status, details?.fieldErrors);
    }
    throw new ApiError("HTTP_ERROR", "Запит завершився помилкою", response.status);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("INVALID_RESPONSE", "Сервер повернув неочікувану відповідь", response.status);
  }
  return parsed.data;
};
