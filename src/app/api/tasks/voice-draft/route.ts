import { z } from "zod";
import { AppError } from "@/shared/api/errors";
import { getServerEnv } from "@/shared/config/env";
import { withHandler } from "@/server/http/handler";
import { demoVoiceTaskDraft, readVoiceAudio, transcribeVoiceTask } from "@/server/tasks/voiceDraft";

export const POST = withHandler(async (request) => {
  const date = z.iso.date().safeParse(request.headers.get("x-local-date"));
  if (!date.success) throw new AppError("VALIDATION_ERROR", 400, "Не вдалося визначити поточну дату");

  const env = getServerEnv();
  if (env.aiMode === "demo") return Response.json({ data: demoVoiceTaskDraft(date.data) });

  const file = await readVoiceAudio(request);
  const data = await transcribeVoiceTask(file, date.data, env, request.signal);
  return Response.json({ data });
});
