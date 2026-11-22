import { beforeEach, describe, expect, it, vi } from "vitest";
import { VOICE_AUDIO_MAX_BYTES } from "@/shared/lib/voiceTaskRecording";
import { readVoiceAudio, transcribeVoiceTask } from "./voiceDraft";

const { transcriptions, completions } = vi.hoisted(() => ({ transcriptions: vi.fn(), completions: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    audio = { transcriptions: { create: transcriptions } };
    chat = { completions: { parse: completions } };
  },
}));

const env = { OPENAI_API_KEY: "test", OPENAI_MODEL: "test" };
const file = new File(["audio"], "task.webm", { type: "audio/webm" });
const signal = new AbortController().signal;

describe("voice task draft", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    { spoken: "Терміново, до завтра о 17:00", priority: "high", dueAtLocal: "2026-11-24T17:00" },
    { spoken: "Це може зачекати", priority: "low", dueAtLocal: null },
    { spoken: "Перевірити аватар", priority: "medium", dueAtLocal: null },
  ])("DEV-016 AC-4: passes local date and validates structured draft for $spoken", async ({ spoken, priority, dueAtLocal }) => {
    const draft = { title: "Перевірити аватар", description: "Перевірити аватар після оновлення профілю.", priority, dueAtLocal };
    transcriptions.mockResolvedValue({ text: spoken });
    completions.mockResolvedValue({ choices: [{ message: { parsed: { draft } } }] });

    await expect(transcribeVoiceTask(file, "2026-11-23", env, signal)).resolves.toEqual(draft);

    expect(transcriptions).toHaveBeenCalledExactlyOnceWith(
      { file, model: "gpt-4o-mini-transcribe", language: "uk" }, { signal },
    );
    expect(completions).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      response_format: expect.objectContaining({ type: "json_schema" }),
      messages: [
        { role: "system", content: expect.stringMatching(/high.*low.*medium[\s\S]*2026-11-23/) },
        { role: "user", content: spoken },
      ],
    }), { signal });
  });

  it("DEV-016 AC-4: rejects a structurally invalid or timezone-bearing deadline", async () => {
    const draft = { title: "Перевірити аватар", description: "Перевірити аватар після оновлення профілю.", priority: "medium" };
    transcriptions.mockResolvedValue({ text: "Перевірити аватар" });
    for (const dueAtLocal of ["2026-02-30T17:00", "2026-11-24T17:00Z", "2026-11-24T17:00+02:00"]) {
      completions.mockResolvedValueOnce({ choices: [{ message: { parsed: { draft: { ...draft, dueAtLocal } } } }] });
      await expect(transcribeVoiceTask(file, "2026-11-23", env, signal)).rejects.toMatchObject({ status: 502 });
    }
  });

  it("DEV-016 AC-5: reports empty speech and upstream errors without exposing provider details", async () => {
    transcriptions.mockResolvedValueOnce({ text: "  " }).mockRejectedValueOnce(new Error("upstream detail"));
    await expect(transcribeVoiceTask(file, "2026-11-23", env, signal)).rejects.toMatchObject({ status: 422 });
    await expect(transcribeVoiceTask(file, "2026-11-23", env, signal)).rejects.toMatchObject({
      status: 502, message: "Не вдалося підготувати чернетку. Спробуйте записати задачу ще раз.",
    });
    expect(completions).not.toHaveBeenCalled();
  });

  it("DEV-016 AC-5: accepts supported recordings and rejects invalid or oversized audio", async () => {
    const audioRequest = (body: BodyInit, type = "audio/webm;codecs=opus") =>
      new Request("http://localhost/api/tasks/voice-draft", { method: "POST", headers: { "content-type": type }, body });

    await expect(readVoiceAudio(audioRequest("audio"))).resolves.toMatchObject({ name: "task.webm", size: 5, type: "audio/webm" });
    await expect(readVoiceAudio(audioRequest(""))).rejects.toMatchObject({ status: 400 });
    await expect(readVoiceAudio(audioRequest("audio", "text/plain"))).rejects.toMatchObject({ status: 400 });
    await expect(readVoiceAudio(audioRequest(new Uint8Array(VOICE_AUDIO_MAX_BYTES + 1)))).rejects.toMatchObject({ status: 413 });
  });
});
