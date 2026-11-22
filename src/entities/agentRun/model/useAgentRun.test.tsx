import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setForceInvalidOutput } from "@/shared/lib/hooks/useForceInvalidOutput";
import type { AgentEvent } from "./types";
import { useAgentRun } from "./useAgentRun";

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

const encoder = new TextEncoder();
const line = (event: AgentEvent) => encoder.encode(`${JSON.stringify(event)}\n`);

/** Керований NDJSON-потік: тест сам вирішує, коли віддати наступну подію. */
const controlledStream = () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({ start: (value) => { controller = value; } });
  return {
    response: new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } }),
    push: (event: AgentEvent) => controller?.enqueue(line(event)),
    pushRaw: (bytes: Uint8Array) => controller?.enqueue(bytes),
    close: () => controller?.close(),
  };
};

const RUN: AgentEvent = { type: "run", runId: "run-1", mode: "demo", steps: [{ label: "Зібрати" }, { label: "Перевірити" }] };

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.mockClear();
  setForceInvalidOutput(false);
});

describe("useAgentRun", () => {
  it("DEV-008 AC-9: idle → running → result; кроки й режим із подій, UTF-8 між чанками", async () => {
    const stream = controlledStream();
    fetchMock.mockResolvedValue(stream.response);
    const { result } = renderHook(() => useAgentRun("prioritize"));
    expect(result.current.run.status).toBe("idle");

    act(() => { void result.current.start({ taskId: "t1" }); });
    expect(result.current.run.status).toBe("running");
    expect(fetchMock).toHaveBeenCalledWith("/api/agents/prioritize", expect.objectContaining({ method: "POST", body: JSON.stringify({ input: { taskId: "t1" } }) }));

    act(() => { stream.push(RUN); });
    await waitFor(() => expect(result.current.run.steps).toEqual([{ label: "Зібрати", state: "pending" }, { label: "Перевірити", state: "pending" }]));
    const bytes = line({ type: "step", index: 0, label: "Зібрати", state: "done", detail: "Знайдено 9" });
    act(() => { stream.pushRaw(bytes.slice(0, 40)); stream.pushRaw(bytes.slice(40)); });
    await waitFor(() => expect(result.current.run.steps[0]).toEqual({ label: "Зібрати", state: "done", detail: "Знайдено 9" }));

    act(() => { stream.push({ type: "result", status: "result", data: { taskId: "t1" } }); stream.close(); });
    await waitFor(() => expect(result.current.run.status).toBe("result"));
    expect(result.current.run).toMatchObject({ mode: "demo", runId: "run-1", data: { taskId: "t1" } });
    expect(result.current.run.finishedAt).not.toBeNull();

    act(() => result.current.markApplied());
    expect(result.current.run.status).toBe("applied");
  });

  it("DEV-008 AC-6 AC-9: stop() перериває запит, повертає idle і відкидає пізні події", async () => {
    const stream = controlledStream();
    fetchMock.mockResolvedValue(stream.response);
    const { result } = renderHook(() => useAgentRun("prioritize"));
    act(() => { void result.current.start({}); });
    act(() => { stream.push(RUN); });
    await waitFor(() => expect(result.current.run.steps).toHaveLength(2));

    act(() => result.current.stop());
    expect(result.current.run.status).toBe("idle");
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);

    act(() => { stream.push({ type: "result", status: "result", data: {} }); });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.run.status).toBe("idle");
    expect(result.current.run.steps).toEqual([]);
  });

  it("DEV-008 AC-9: новий запуск відкидає події попереднього", async () => {
    const first = controlledStream();
    const second = controlledStream();
    fetchMock.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response);
    const { result } = renderHook(() => useAgentRun("prioritize"));
    act(() => { void result.current.start({}); });
    act(() => { void result.current.start({}); });
    act(() => { second.push({ ...RUN, runId: "run-2" }); });
    await waitFor(() => expect(result.current.run.runId).toBe("run-2"));
    act(() => { first.push(RUN); first.push({ type: "fallback", reason: "старе", data: null }); });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.run).toMatchObject({ status: "running", runId: "run-2" });
  });

  it("DEV-008 AC-9: dismiss() → idle і тост «Відхилено»", async () => {
    const stream = controlledStream();
    fetchMock.mockResolvedValue(stream.response);
    const { result } = renderHook(() => useAgentRun("prioritize"));
    act(() => { void result.current.start({}); });
    act(() => { stream.push(RUN); stream.push({ type: "fallback", reason: "Модель відмовилась", data: { taskId: "t1" } }); stream.close(); });
    await waitFor(() => expect(result.current.run).toMatchObject({ status: "fallback", fallbackReason: "Модель відмовилась" }));

    act(() => result.current.dismiss());
    expect(result.current.run.status).toBe("idle");
    expect(toast).toHaveBeenCalledWith("Відхилено");
  });

  it("DEV-008 AC-9: server stopped → idle; помилка HTTP і обірваний стрім → error", async () => {
    const stopped = controlledStream();
    fetchMock.mockResolvedValueOnce(stopped.response);
    const { result } = renderHook(() => useAgentRun("prioritize"));
    act(() => { void result.current.start({}); });
    act(() => { stopped.push(RUN); stopped.push({ type: "stopped" }); stopped.close(); });
    await waitFor(() => expect(result.current.run.status).toBe("idle"));
    expect(result.current.run.runId).toBeNull();

    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "VALIDATION_ERROR", message: "Невалідні дані" } }, { status: 400 }));
    await act(() => result.current.start({}));
    expect(result.current.run).toMatchObject({ status: "error", error: { code: "VALIDATION_ERROR", message: "Невалідні дані" } });

    const cut = controlledStream();
    fetchMock.mockResolvedValueOnce(cut.response);
    act(() => { void result.current.start({}); });
    act(() => { cut.push(RUN); cut.close(); });
    await waitFor(() => expect(result.current.run).toMatchObject({ status: "error", error: { code: "STREAM_ENDED" } }));
  });

  it("DEV-008 AC-8: dev-прапорець «Зламати відповідь агента» додає debug.forceInvalidOutput у запит", async () => {
    fetchMock.mockResolvedValue(new Response(`${JSON.stringify({ type: "stopped" })}\n`));
    setForceInvalidOutput(true);
    const { result } = renderHook(() => useAgentRun("decompose"));
    await act(() => result.current.start({ taskId: "t1" }));
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ input: { taskId: "t1" }, debug: { forceInvalidOutput: true } }));
  });
});
