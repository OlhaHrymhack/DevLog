import "server-only";
import { z } from "zod";
import type { AgentContext, AgentTool } from "./types";

/** Службовий tool, яким модель віддає фінальний результат. Лише завершує обчислення, нічого не пише. */
export const SUBMIT_RESULT_TOOL = "submit_result";

/**
 * Allowlist інструментів агентів. Тут лише читання: tool із записом (create/update/delete)
 * у реєстр не потрапить — додавання нового імені вимагає свідомої правки й рев'ю.
 */
export const READ_TOOL_NAMES = ["list_tasks", "get_task"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Ключові слова JSON Schema, яких strict-режим OpenAI не приймає (запит отримає 400 лише в live). */
const UNSUPPORTED_KEYWORDS = ["oneOf", "allOf", "not", "uniqueItems", "patternProperties", "propertyNames", "prefixItems"] as const;

/**
 * Strict-режим tools OpenAI: корінь — object, кожен об'єкт — `additionalProperties: false` з усіма властивостями в `required`,
 * без непідтримуваних ключових слів і без tuple-`items`. `minLength`/`pattern`/`format` SDK дозволяє.
 * `isPropertyMap` — вузол `properties`: його ключі є іменами полів, а не ключовими словами.
 */
const assertStrictCompatible = (schema: unknown, path: string, isPropertyMap = false): void => {
  if (Array.isArray(schema)) {
    schema.forEach((item, index) => assertStrictCompatible(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(schema)) return;
  if (!isPropertyMap) {
    const unsupported = UNSUPPORTED_KEYWORDS.find((keyword) => keyword in schema);
    if (unsupported) throw new Error(`Schema at ${path} uses "${unsupported}", which strict mode does not support`);
    if (Array.isArray(schema.items)) throw new Error(`Schema at ${path} uses tuple "items", which strict mode does not support`);
  }
  const properties = schema.properties;
  if (!isPropertyMap && schema.type === "object" && isRecord(properties)) {
    const required = Array.isArray(schema.required) ? schema.required : [];
    const missing = Object.keys(properties).filter((key) => !required.includes(key));
    if (schema.additionalProperties !== false || missing.length > 0) {
      throw new Error(`Schema at ${path} is not strict-compatible: use z.object with required (nullable) fields`);
    }
  }
  for (const [key, value] of Object.entries(schema)) {
    assertStrictCompatible(value, `${path}.${key}`, !isPropertyMap && key === "properties");
  }
};

/** Zod → JSON Schema для параметрів tool (без `$schema`), з перевіркою сумісності зі strict-режимом. */
export const toToolParameters = (schema: z.ZodType): Record<string, unknown> => {
  const parameters: Record<string, unknown> = { ...z.toJSONSchema(schema, { target: "draft-7" }) };
  delete parameters.$schema;
  if (parameters.type !== "object") throw new Error("Tool parameters schema must be a z.object (root type: object)");
  assertStrictCompatible(parameters, "$");
  return parameters;
};

type ToolConfig<Input extends z.ZodType> = {
  name: string;
  label: string;
  description: string;
  inputSchema: Input;
  run: (input: z.infer<Input>, ctx: AgentContext) => unknown;
};

export const defineTool = <Input extends z.ZodType>({ name, label, description, inputSchema, run }: ToolConfig<Input>): AgentTool => ({
  name,
  label,
  description,
  parameters: toToolParameters(inputSchema),
  execute: async (input, ctx) => run(inputSchema.parse(input), ctx),
});

const isReadToolName = (name: string) => READ_TOOL_NAMES.some((allowed) => allowed === name);

/** Реєстр tools агента: лише імена з allowlist, без дублікатів і без зарезервованого `submit_result`. */
export const createToolRegistry = (tools: readonly AgentTool[]): ReadonlyMap<string, AgentTool> => {
  const registry = new Map<string, AgentTool>();
  for (const tool of tools) {
    if (!isReadToolName(tool.name)) throw new Error(`Tool "${tool.name}" is not in the read-only allowlist`);
    if (registry.has(tool.name)) throw new Error(`Tool "${tool.name}" is registered twice`);
    registry.set(tool.name, tool);
  }
  return registry;
};
