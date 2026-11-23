import { TaskCreateInputSchema, TaskListQuerySchema, TaskPageQuerySchema } from "@/entities/task";
import { readJson, withHandler } from "@/server/http/handler";
import { getTaskService } from "@/server/tasks/service";

export const GET = withHandler((request) => {
  const params = new URL(request.url).searchParams;
  const query = Object.fromEntries(params);
  if (params.has("page") || params.has("pageSize")) {
    const pageQuery = TaskPageQuerySchema.parse(query);
    return Response.json(getTaskService().listTaskPage(pageQuery));
  }
  const listQuery = TaskListQuerySchema.parse(query);
  return Response.json({ data: getTaskService().listTasks(listQuery) });
});

export const POST = withHandler(async (request) => {
  const input = TaskCreateInputSchema.strict().parse(await readJson(request));
  return Response.json({ data: getTaskService().createTask(input) }, { status: 201 });
});
