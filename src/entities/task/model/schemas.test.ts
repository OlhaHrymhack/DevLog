import { describe, expect, it } from "vitest";
import {
  NoteCreateInputSchema,
  SubtaskCreateInputSchema,
  SubtaskUpdateInputSchema,
  TaskCreateInputSchema,
  TaskListQuerySchema,
  TaskUpdateInputSchema,
} from "./schemas";

const VALID_CREATE = { title: "Нова задача", description: "Опис задачі" };

describe("Zod-контракти задачі", () => {
  it("DEV-003 AC-3: title \"  ab \" (після trim < 3) → помилка", () => {
    expect(TaskCreateInputSchema.safeParse({ ...VALID_CREATE, title: "  ab " }).success).toBe(false);
  });

  it("DEV-003 AC-3: title довший за 120 символів → помилка; title обрізається trim", () => {
    expect(TaskCreateInputSchema.safeParse({ ...VALID_CREATE, title: "a".repeat(121) }).success).toBe(false);
    expect(TaskCreateInputSchema.parse({ ...VALID_CREATE, title: "  abc  " }).title).toBe("abc");
  });

  it("DEV-003 AC-3: description з 4 символів → помилка", () => {
    expect(TaskCreateInputSchema.safeParse({ ...VALID_CREATE, description: "abcd" }).success).toBe(false);
    expect(TaskCreateInputSchema.safeParse({ ...VALID_CREATE, description: "  abcd  " }).success).toBe(false);
  });

  it("DEV-003 AC-3: status \"blocked\" → помилка", () => {
    expect(TaskCreateInputSchema.safeParse({ ...VALID_CREATE, status: "blocked" }).success).toBe(false);
    expect(TaskUpdateInputSchema.safeParse({ status: "blocked" }).success).toBe(false);
  });

  it("DEV-003 AC-3: create без status/priority → todo/medium", () => {
    const parsed = TaskCreateInputSchema.parse(VALID_CREATE);
    expect(parsed.status).toBe("todo");
    expect(parsed.priority).toBe("medium");
    expect(parsed.dueAt).toBeUndefined();
  });

  it("DEV-003 AC-3: dueAt має бути ISO з часовою зоною", () => {
    expect(TaskCreateInputSchema.safeParse({ ...VALID_CREATE, dueAt: "завтра" }).success).toBe(false);
    expect(TaskCreateInputSchema.safeParse({ ...VALID_CREATE, dueAt: "2026-11-22T10:00:00+02:00" }).success).toBe(true);
  });

  it("DEV-003 AC-3: update з createdAt, id, updatedAt або focusRank → помилка (strict)", () => {
    expect(TaskUpdateInputSchema.safeParse({ createdAt: "2026-11-21T12:00:00.000Z" }).success).toBe(false);
    expect(TaskUpdateInputSchema.safeParse({ title: "Нова назва", id: "t1" }).success).toBe(false);
    expect(TaskUpdateInputSchema.safeParse({ updatedAt: "2026-11-21T12:00:00.000Z" }).success).toBe(false);
    expect(TaskUpdateInputSchema.safeParse({ focusRank: 1 }).success).toBe(false);
  });

  it("DEV-003 AC-3: update {} і update лише з undefined → помилка", () => {
    expect(TaskUpdateInputSchema.safeParse({}).success).toBe(false);
    expect(TaskUpdateInputSchema.safeParse({ title: undefined }).success).toBe(false);
  });

  it("DEV-003 AC-3: update { title } не підставляє defaults (немає ключа status)", () => {
    const parsed = TaskUpdateInputSchema.parse({ title: "Нова назва" });
    expect(parsed).toEqual({ title: "Нова назва" });
    expect("status" in parsed).toBe(false);
    expect("priority" in parsed).toBe(false);
  });

  it("DEV-003 AC-3: update dueAt: null дозволений (зняти дедлайн)", () => {
    expect(TaskUpdateInputSchema.parse({ dueAt: null })).toEqual({ dueAt: null });
  });

  it("DEV-003 AC-3: SubtaskCreateInput title з 201 символу → помилка; source обов'язковий", () => {
    expect(SubtaskCreateInputSchema.safeParse({ title: "a".repeat(201), source: "user" }).success).toBe(false);
    expect(SubtaskCreateInputSchema.safeParse({ title: "Крок" }).success).toBe(false);
    expect(SubtaskCreateInputSchema.safeParse({ title: "Крок", source: "ai", estimate: "~2 год" }).success).toBe(true);
  });

  it("DEV-003 AC-3: SubtaskUpdateInput {} і невідоме поле → помилка", () => {
    expect(SubtaskUpdateInputSchema.safeParse({}).success).toBe(false);
    expect(SubtaskUpdateInputSchema.safeParse({ status: "done", taskId: "t2" }).success).toBe(false);
    expect(SubtaskUpdateInputSchema.parse({ status: "done" })).toEqual({ status: "done" });
  });

  it("DEV-003 AC-3: NoteCreateInput \"   \" → помилка", () => {
    expect(NoteCreateInputSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(NoteCreateInputSchema.safeParse({ text: "a".repeat(2001) }).success).toBe(false);
  });

  it("DEV-003 AC-3: TaskListQuery sort \"bar\" → помилка; defaults priority/desc; порожній q → без фільтра", () => {
    expect(TaskListQuerySchema.safeParse({ sort: "bar" }).success).toBe(false);
    expect(TaskListQuerySchema.safeParse({ order: "up" }).success).toBe(false);
    expect(TaskListQuerySchema.parse({})).toEqual({ sort: "priority", order: "desc" });
    expect(TaskListQuerySchema.parse({ q: "   " }).q).toBeUndefined();
    expect(TaskListQuerySchema.parse({ q: " пам " }).q).toBe("пам");
  });
});
