import { SetSubtaskStatusInputSchema } from "@/entities/task";
import { readJson, requireFound, withHandler } from "@/server/http/handler";
import { getTaskService } from "@/server/tasks/service";
import { NotFoundError } from "@/shared/api/errors";

type Context = { params: Promise<{ id: string; subtaskId: string }> };
const NOT_FOUND = "Підзадачу не знайдено";

export const PATCH = withHandler(async (request, { params }: Context) => {
  const { id, subtaskId } = await params;
  const input = SetSubtaskStatusInputSchema.parse(await readJson(request));
  return Response.json({ data: requireFound(getTaskService().updateSubtask(id, subtaskId, input), NOT_FOUND) });
});

export const DELETE = withHandler(async (_request, { params }: Context) => {
  const { id, subtaskId } = await params;
  if (!getTaskService().deleteSubtask(id, subtaskId)) throw new NotFoundError(NOT_FOUND);
  return new Response(null, { status: 204 });
});
