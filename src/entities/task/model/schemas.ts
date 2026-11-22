import { z } from "zod";

export const TaskStatusSchema = z.enum(["todo", "in-progress", "done"]);
export const TaskPrioritySchema = z.enum(["low", "medium", "high"]);

/** Підзадача має ті самі статуси, що й задача (UI перемикає todo ↔ done). */
export const SubtaskStatusSchema = TaskStatusSchema;
export const SubtaskSourceSchema = z.enum(["user", "ai"]);

/** ISO 8601 з часовою зоною (`Z` або офсет). Сервер зберігає лише UTC (`toISOString()`). */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

// Базові поля без `.default()`: у Zod 4 `.partial()` все одно підставляє default, що зламало б update.
export const TaskTitleSchema = z.string().trim().min(3).max(120);
export const TaskDescriptionSchema = z.string().trim().min(5).max(2000);
export const TaskDueAtSchema = IsoDateTimeSchema;
export const TaskFocusRankSchema = z.number().int().min(1);

export const SubtaskTitleSchema = z.string().trim().min(1).max(200);
export const SubtaskEstimateSchema = z.string().trim().min(1).max(50);
export const SubtaskRationaleSchema = z.string().trim().min(1).max(1000);
export const NoteTextSchema = z.string().trim().min(1).max(2000);

const hasAnyField = (value: Record<string, unknown>): boolean => {
  return Object.values(value).some((field) => field !== undefined);
};

const AT_LEAST_ONE_FIELD = { message: "Потрібне хоча б одне поле" };

export const SubtaskSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  title: SubtaskTitleSchema,
  status: SubtaskStatusSchema,
  source: SubtaskSourceSchema,
  estimate: SubtaskEstimateSchema.nullable(),
  rationale: SubtaskRationaleSchema.nullable(),
  position: z.number().int().min(0),
  createdAt: IsoDateTimeSchema,
});

/** Нотатка — частина агрегату Task: не існує без задачі (каскадне видалення). */
export const NoteSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  text: NoteTextSchema,
  createdAt: IsoDateTimeSchema,
});

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  dueAt: TaskDueAtSchema.nullable(),
  focusRank: TaskFocusRankSchema.nullable(),
  subtasks: z.array(SubtaskSchema),
  notes: z.array(NoteSchema),
});

/** Елемент списку (`GET /api/tasks`): без нотаток і підзадач, з агрегатами підзадач. */
export const TaskListItemSchema = TaskSchema.omit({ subtasks: true, notes: true }).extend({
  subtaskCount: z.number().int().min(0),
  subtaskDone: z.number().int().min(0),
});

export const TaskCreateInputSchema = z.object({
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
  status: TaskStatusSchema.default("todo"),
  priority: TaskPrioritySchema.default("medium"),
  dueAt: TaskDueAtSchema.optional(),
});

/** `id`, `createdAt`, `updatedAt`, `focusRank` змінювати не можна (strict); фокус — лише через `setFocus`. */
export const TaskUpdateInputSchema = z
  .object({
    title: TaskTitleSchema,
    description: TaskDescriptionSchema,
    status: TaskStatusSchema,
    priority: TaskPrioritySchema,
    dueAt: TaskDueAtSchema.nullable(),
  })
  .partial()
  .strict()
  .refine(hasAnyField, AT_LEAST_ONE_FIELD);

export const SubtaskCreateInputSchema = z.object({
  title: SubtaskTitleSchema,
  source: SubtaskSourceSchema,
  estimate: SubtaskEstimateSchema.optional(),
  rationale: SubtaskRationaleSchema.optional(),
});

export const SubtaskUpdateInputSchema = z
  .object({
    title: SubtaskTitleSchema,
    status: SubtaskStatusSchema,
  })
  .partial()
  .strict()
  .refine(hasAnyField, AT_LEAST_ONE_FIELD);

export const NoteCreateInputSchema = z.object({
  text: NoteTextSchema,
});

export const TaskSortSchema = z.enum(["priority", "createdAt"]);
export const SortOrderSchema = z.enum(["asc", "desc"]);

const emptyToUndefined = (value: string | undefined): string | undefined => {
  return value === "" ? undefined : value;
};

/** Параметри списку; DEV-004 перевикористовує схему для query `GET /api/tasks`. */
export const TaskListQuerySchema = z.strictObject({
  status: TaskStatusSchema.optional(),
  q: z.string().trim().max(200).optional().transform(emptyToUndefined),
  sort: TaskSortSchema.default("priority"),
  order: SortOrderSchema.default("desc"),
});
