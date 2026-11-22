import { SetFocusInputSchema } from "@/entities/task";
import { readJson, withHandler } from "@/server/http/handler";
import { getTaskService } from "@/server/tasks/service";

export const PUT = withHandler(async (request) => {
  const { taskIds } = SetFocusInputSchema.parse(await readJson(request));
  return Response.json({ data: getTaskService().setFocus(taskIds) });
});
