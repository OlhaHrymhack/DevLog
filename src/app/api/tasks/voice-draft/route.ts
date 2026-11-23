import { z } from "zod";
import { AppError } from "@/shared/api/errors";
import { getServerEnv } from "@/shared/config/env";
import { reserveAgentQuota } from "@/server/agentQuota/reserve";
import { withHandler } from "@/server/http/handler";
import { demoVoiceTaskDraft, readVoiceAudio, transcribeVoiceTask } from "@/server/tasks/voiceDraft";

export const POST = withHandler(async (request) => {
  const date = z.iso.date().safeParse(request.headers.get("x-local-date"));
  if (!date.success) throw new AppError("VALIDATION_ERROR", 400, "Не вдалося визначити поточну дату");

  const env = getServerEnv();
  const file = env.aiMode === "live" ? await readVoiceAudio(request) : null;
  if (env.agentQuota) await reserveAgentQuota("voice-draft");
  const data = file ? await transcribeVoiceTask(file, date.data, env, request.signal) : demoVoiceTaskDraft(date.data);
  return Response.json({ data });
});
