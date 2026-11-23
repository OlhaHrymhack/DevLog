import { z } from "zod";

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.object({
      fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
    }).passthrough().optional(),
  }),
});

type ErrorDetails = z.infer<typeof ApiErrorResponseSchema>["error"]["details"];

export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", 404, message);
    this.name = "NotFoundError";
  }
}

const errorResponse = ({ code, message, status, details }: AppError): Response =>
  Response.json({ error: { code, message, details } }, { status });

export const toErrorResponse = (error: unknown): Response => {
  if (error instanceof z.ZodError) {
    return errorResponse(new AppError("VALIDATION_ERROR", 400, "Невалідні дані", {
      fieldErrors: z.flattenError(error).fieldErrors,
    }));
  }
  if (error instanceof AppError) return errorResponse(error);
  return errorResponse(new AppError("INTERNAL_ERROR", 500, "Внутрішня помилка сервера"));
};
