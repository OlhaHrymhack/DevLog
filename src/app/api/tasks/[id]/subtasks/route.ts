import { AddSubtasksInputSchema } from "@/entities/task";
import { readJson, requireFound, withHandler } from "@/server/http/handler";
import { getTaskService } from "@/server/tasks/service";

export const POST = withHandler(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { items } = AddSubtasksInputSchema.parse(await readJson(request));
  const data = requireFound(await (await getTaskService()).addSubtasks(id, items), "Задачу не знайдено");
  return Response.json({ data }, { status: 201 });
});
