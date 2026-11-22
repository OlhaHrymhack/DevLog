import "server-only";
import { randomUUID } from "node:crypto";
import { AppError, NotFoundError, toErrorResponse } from "@/shared/api/errors";
import { logger } from "../logger";

export const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", 400, "Невалідний JSON");
  }
};

export const requireFound = <T>(value: T | null, message: string): T => {
  if (value === null) throw new NotFoundError(message);
  return value;
};

export const withHandler = <Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Response | Promise<Response>,
) => async (request: Request, ...args: Args): Promise<Response> => {
  const startedAt = performance.now();
  const requestId = randomUUID();
  const path = new URL(request.url).pathname;
  let response: Response;

  try {
    response = await handler(request, ...args);
  } catch (error) {
    response = toErrorResponse(error);
    if (response.status >= 500) {
      const frames = error instanceof Error ? error.stack?.split("\n").filter((line) => /^\s+at /.test(line)) : undefined;
      logger.error({ requestId, path, frames }, "Request failed");
    }
  }

  response.headers.set("x-request-id", requestId);
  logger.info({
    requestId, method: request.method, path, status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
  }, "Request completed");
  return response;
};
