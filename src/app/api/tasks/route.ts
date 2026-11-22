import { TaskCreateInputSchema, TaskListQuerySchema } from "@/entities/task";
import { readJson, withHandler } from "@/server/http/handler";
import { getTaskService } from "@/server/tasks/service";

export const GET = withHandler((request) => {
  const query = TaskListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return Response.json({ data: getTaskService().listTasks(query) });
});

export const POST = withHandler(async (request) => {
  const input = TaskCreateInputSchema.strict().parse(await readJson(request));
  return Response.json({ data: getTaskService().createTask(input) }, { status: 201 });
});
