import { expect, it, vi } from "vitest";
import { POST as createVoiceDraft } from "@/app/api/tasks/voice-draft/route";
import { getServerEnv, parseServerEnv } from "@/shared/config/env";
import { createAgentQuotaRepository } from "@/server/agentQuota/repository";
import { createDb, getDb } from "@/server/db/client";

const { transcriptions, completions } = vi.hoisted(() => ({ transcriptions: vi.fn(), completions: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    audio = { transcriptions: { create: transcriptions } };
    chat = { completions: { parse: completions } };
  },
}));

vi.mock(import("@/shared/config/env"), async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, getServerEnv: vi.fn(() => original.parseServerEnv({})) };
});
vi.mock(import("@/server/db/client"), async (importOriginal) => ({
  ...await importOriginal(),
  getDb: vi.fn(),
}));

const env = { OPENAI_API_KEY: "test", OPENAI_MODEL: "test" };

it("DEV-018 AC-2: голосова чернетка має 50 запусків і не викликає модель після вичерпання квоти", async () => {
  const connection = await createDb(":memory:");
  try {
    vi.mocked(getServerEnv).mockReturnValue(parseServerEnv({ ...env, AGENT_QUOTA: "on" }));
    vi.mocked(getDb).mockResolvedValue(connection);
    transcriptions.mockResolvedValue({ text: "Перевірити аватар" });
    completions.mockResolvedValue({ choices: [{ message: { parsed: {
      draft: { title: "Перевірити аватар", description: "Перевірити аватар у профілі.", priority: "medium", dueAtLocal: null },
    } } }] });

    const send = (body: BodyInit) => createVoiceDraft(new Request("http://localhost/api/tasks/voice-draft", {
      method: "POST",
      headers: { "content-type": "audio/webm", "x-local-date": "2026-11-23" },
      body,
    }));

    expect((await send("")).status).toBe(400);
    expect((await send("invalid WebM header")).status).toBe(400);
    expect(await createAgentQuotaRepository(connection.db).getUsage("voice-draft")).toBe(0);
    expect(transcriptions).not.toHaveBeenCalled();
    const webmHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x81, 0x00]);
    const responses = await Promise.all(Array.from({ length: 52 }, () => send(webmHeader)));
    expect(responses.filter((response) => response.status === 200)).toHaveLength(50);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(2);
    expect(await responses.find((response) => response.status === 429)?.json()).toMatchObject({ error: { code: "AGENT_QUOTA_EXHAUSTED" } });
    expect(transcriptions).toHaveBeenCalledTimes(50);
    expect(completions).toHaveBeenCalledTimes(50);
    expect(await createAgentQuotaRepository(connection.db).getUsage("voice-draft")).toBe(50);
    expect(await createAgentQuotaRepository(connection.db).getUsage("decompose")).toBe(0);
  } finally {
    connection.close();
  }
});
