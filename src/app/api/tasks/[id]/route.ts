import { readJson, requireFound, withHandler } from "@/server/http/handler";
import { getTaskService } from "@/server/tasks/service";
import { NotFoundError } from "@/shared/api/errors";

type Context = { params: Promise<{ id: string }> };
const NOT_FOUND = "Задачу не знайдено";

export const GET = withHandler(async (_request, { params }: Context) => {
  const { id } = await params;
  return Response.json({ data: requireFound(getTaskService().getTask(id), NOT_FOUND) });
});

export const PATCH = withHandler(async (request, { params }: Context) => {
  const { id } = await params;
  const input = await readJson(request);
  return Response.json({ data: requireFound(getTaskService().updateTask(id, input), NOT_FOUND) });
});

export const DELETE = withHandler(async (_request, { params }: Context) => {
  const { id } = await params;
  if (!getTaskService().deleteTask(id)) throw new NotFoundError(NOT_FOUND);
  return new Response(null, { status: 204 });
});
