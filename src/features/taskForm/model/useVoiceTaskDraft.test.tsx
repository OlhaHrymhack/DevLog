// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VOICE_RECORDING_MAX_MS } from "@/shared/lib/voiceTaskRecording";
import { useVoiceTaskDraft } from "./useVoiceTaskDraft";

const trackStop = vi.fn();
const getUserMedia = vi.fn();
const fetchMock = vi.fn();
const draft = { title: "Перевірити аватар", description: "Перевірити аватар профілю.", priority: "medium", dueAtLocal: null };

class TestRecorder {
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;

  start = () => { this.state = "recording"; };
  stop = () => {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"]) });
    this.onstop?.();
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", TestRecorder);
  vi.stubGlobal("fetch", fetchMock);
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });
  fetchMock.mockImplementation(async () => Response.json({ data: draft }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("DEV-016 AC-2: captures audio on demand and releases the microphone after manual stop", async () => {
  const onDraft = vi.fn();
  const { result } = renderHook(() => useVoiceTaskDraft(onDraft));
  expect(getUserMedia).not.toHaveBeenCalled();

  await act(async () => result.current.begin(false));
  expect(result.current.phase).toBe("recording");
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => result.current.stop());

  expect(trackStop).toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/tasks/voice-draft", expect.objectContaining({
    method: "POST", body: expect.objectContaining({ type: "audio/webm", size: 5 }),
  }));
  expect(onDraft).toHaveBeenCalledExactlyOnceWith(draft);
  expect(result.current.phase).toBe("idle");
});

it("DEV-016 AC-2: stops a recording at the time limit", async () => {
  vi.useFakeTimers();
  const listener = vi.fn();
  const { result } = renderHook(() => useVoiceTaskDraft(listener));
  await act(async () => result.current.begin(false));
  await act(async () => vi.advanceTimersByTimeAsync(VOICE_RECORDING_MAX_MS - 1));
  expect(result.current.phase).toBe("recording");
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(listener).toHaveBeenCalledExactlyOnceWith(draft);
  expect(trackStop).toHaveBeenCalled();
});

it("DEV-016 AC-2: discards a closed dialog's recording and aborts an in-flight request", async () => {
  const listener = vi.fn();
  const first = renderHook(() => useVoiceTaskDraft(listener));
  await act(async () => first.result.current.begin(false));
  first.unmount();
  expect(trackStop).toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();

  const pending = Promise.withResolvers<Response>();
  fetchMock.mockReturnValueOnce(pending.promise);
  const second = renderHook(() => useVoiceTaskDraft(listener));
  await act(async () => second.result.current.begin(false));
  act(() => second.result.current.stop());
  const signal: AbortSignal = fetchMock.mock.calls[0]?.[1].signal;
  expect(signal.aborted).toBe(false);
  second.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(Response.json({ data: draft })));
  expect(listener).not.toHaveBeenCalled();
});

it("DEV-016 AC-5: reports permission and API errors, then allows retry", async () => {
  const listener = vi.fn();
  const { result } = renderHook(() => useVoiceTaskDraft(listener));
  getUserMedia.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
  await act(async () => result.current.begin(false));
  expect(result.current.error).toContain("Дозвольте доступ");
  expect(fetchMock).not.toHaveBeenCalled();

  fetchMock.mockResolvedValueOnce(Response.json({
    error: { code: "VOICE_DRAFT_FAILED", message: "Спробуйте записати задачу ще раз." },
  }, { status: 502 }));
  await act(async () => result.current.begin(false));
  await act(async () => result.current.stop());
  expect(result.current.error).toBe("Спробуйте записати задачу ще раз.");
  expect(listener).not.toHaveBeenCalled();
  await act(async () => result.current.begin(false));
  await act(async () => result.current.stop());
  expect(result.current.error).toBe("");
  expect(listener).toHaveBeenCalledExactlyOnceWith(draft);
});

it("DEV-016 AC-2: cancels permission wait and releases a microphone granted afterwards", async () => {
  const permission = Promise.withResolvers<{ getTracks: () => { stop: typeof trackStop }[] }>();
  getUserMedia.mockReturnValueOnce(permission.promise);
  const listener = vi.fn();
  const { result } = renderHook(() => useVoiceTaskDraft(listener));

  act(() => { void result.current.begin(false); });
  expect(result.current.phase).toBe("requesting");
  act(() => result.current.cancel());
  expect(result.current.phase).toBe("idle");
  await act(async () => permission.resolve({ getTracks: () => [{ stop: trackStop }] }));
  expect(trackStop).toHaveBeenCalledExactlyOnceWith();
  expect(fetchMock).not.toHaveBeenCalled();
});
