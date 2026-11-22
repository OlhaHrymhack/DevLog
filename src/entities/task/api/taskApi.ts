import { z } from "zod";
import { fetchJson } from "@/shared/api/http";
import {
  NoteSchema, SubtaskSchema, TaskCreateInputSchema, TaskListItemSchema, TaskListQuerySchema, TaskSchema,
} from "../model/schemas";
import type { NoteCreateInput, TaskListQuery, TaskUpdateInput } from "../model/types";
import { FocusAssignmentSchema, type AddSubtasksInput, type SetFocusInput, type SetSubtaskStatusInput } from "./contracts";

const BASE = "/api/tasks";
const taskUrl = (id: string) => `${BASE}/${encodeURIComponent(id)}`;
const subtaskUrl = (taskId: string, subtaskId: string) => `${taskUrl(taskId)}/subtasks/${encodeURIComponent(subtaskId)}`;

const fetchData = async <T>(url: string, schema: z.ZodType<T>, options?: RequestInit): Promise<T> => {
  const { data } = await fetchJson(url, z.object({ data: schema }), options);
  return data;
};

const json = (method: string, input: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});

const listQuery = (query: Partial<TaskListQuery>) => TaskListQuerySchema.parse(query);

export const taskQueryKeys = {
  all: ["tasks"] as const,
  lists: () => ["tasks", "list"] as const,
  list: (query: Partial<TaskListQuery> = {}) => ["tasks", "list", listQuery(query)] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
};

export const taskApi = {
  list: (query: Partial<TaskListQuery> = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(listQuery(query))) {
      if (value !== undefined) params.set(key, value);
    }
    return fetchData(`${BASE}?${params}`, z.array(TaskListItemSchema), { signal });
  },
  get: (id: string, signal?: AbortSignal) => fetchData(taskUrl(id), TaskSchema, { signal }),
  create: (input: z.input<typeof TaskCreateInputSchema>) => fetchData(BASE, TaskSchema, json("POST", input)),
  update: (id: string, input: TaskUpdateInput) => fetchData(taskUrl(id), TaskSchema, json("PATCH", input)),
  delete: (id: string) => fetchJson(taskUrl(id), z.undefined(), { method: "DELETE" }),
  addSubtasks: (id: string, input: AddSubtasksInput) =>
    fetchData(`${taskUrl(id)}/subtasks`, z.array(SubtaskSchema), json("POST", input)),
  updateSubtask: (id: string, subtaskId: string, input: SetSubtaskStatusInput) =>
    fetchData(subtaskUrl(id, subtaskId), SubtaskSchema, json("PATCH", input)),
  deleteSubtask: (id: string, subtaskId: string) =>
    fetchJson(subtaskUrl(id, subtaskId), z.undefined(), { method: "DELETE" }),
  addNote: (id: string, input: NoteCreateInput) =>
    fetchData(`${taskUrl(id)}/notes`, NoteSchema, json("POST", input)),
  setFocus: (input: SetFocusInput) =>
    fetchData(`${BASE}/focus`, z.array(FocusAssignmentSchema), json("PUT", input)),
};
