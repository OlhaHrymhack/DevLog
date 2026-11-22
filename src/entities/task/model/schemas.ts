import { z } from "zod";

export const TaskStatusSchema = z.enum(["todo", "in-progress", "done"]);
export const TaskPrioritySchema = z.enum(["low", "medium", "high"]);
