import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, fetchJson } from "./http";

afterEach(() => vi.unstubAllGlobals());

it("DEV-004 AC-9: maps an API validation error to ApiError with field errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
    error: { code: "VALIDATION_ERROR", message: "Невалідні дані", details: { fieldErrors: { title: ["Required"] } } },
  }, { status: 400 })));
  const result = fetchJson("/api/tasks", z.unknown());
  await expect(result).rejects.toBeInstanceOf(ApiError);
  await expect(result).rejects.toMatchObject({
    code: "VALIDATION_ERROR", status: 400, fieldErrors: { title: ["Required"] },
  });
});

it("DEV-004 AC-9: maps network failures and preserves request cancellation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Offline")));
  await expect(fetchJson("/api/tasks", z.unknown())).rejects.toMatchObject({ code: "NETWORK_ERROR" });

  const controller = new AbortController();
  const abort = new DOMException("Cancelled", "AbortError");
  controller.abort(abort);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
  await expect(fetchJson("/api/tasks", z.unknown(), { signal: controller.signal })).rejects.toBe(abort);
});

it("DEV-004 AC-9: accepts empty 204 and rejects malformed success responses", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json({ data: "wrong type" })));
  await expect(fetchJson("/api/tasks/t1", z.undefined(), { method: "DELETE" })).resolves.toBeUndefined();
  await expect(fetchJson("/api/tasks", z.object({ data: z.array(z.string()) })))
    .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
