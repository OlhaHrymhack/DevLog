import "server-only";
import { and, asc, eq } from "drizzle-orm";
import {
  AgentRunCreateInputSchema, AgentRunFinishInputSchema, AgentStepAppendInputSchema,
  type AgentRun, type AgentStepRecord,
} from "@/entities/agentRun";
import type { DbExecutor } from "../db/client";
import { createId } from "../ids";
import { agentRuns, agentSteps } from "./schema";

type CreateRunInput = Pick<AgentRun, "kind" | "mode"> & { taskId?: string | null };
type AppendStepInput = Pick<AgentStepRecord, "type" | "label" | "state"> & { detail?: string | null; payload?: unknown };
type FinishRunInput = { status: Exclude<AgentRun["status"], "running">; result?: unknown; error?: unknown };

const toAgentRun = ({ resultJson, errorJson, ...row }: typeof agentRuns.$inferSelect): AgentRun => ({
  ...row, result: resultJson, error: errorJson,
});

const toAgentStep = ({ payloadJson, ...row }: typeof agentSteps.$inferSelect): AgentStepRecord => ({
  ...row, payload: payloadJson,
});

export const createAgentRunRepository = (db: DbExecutor) => {
  const createRun = async (input: CreateRunInput, now = new Date()): Promise<AgentRun> =>
    toAgentRun(await db.insert(agentRuns).values({
      ...AgentRunCreateInputSchema.parse(input), id: createId(), status: "running", startedAt: now.toISOString(),
    }).returning().get());

  /** Номер кроку рахується і пишеться в одній транзакції через `tx`, тож паралельні кроки не дублюють індекс. */
  const appendStep = (runId: string, input: AppendStepInput, now = new Date()): Promise<AgentStepRecord> => {
    const { type, label, state, detail, payload } = AgentStepAppendInputSchema.parse(input);
    return db.transaction(async (tx) => {
      const index = await tx.$count(agentSteps, eq(agentSteps.runId, runId));
      return toAgentStep(await tx.insert(agentSteps).values({
        id: createId(), runId, index, type, label, state,
        detail, payloadJson: payload, createdAt: now.toISOString(),
      }).returning().get());
    });
  };

  const finishRun = async (id: string, input: FinishRunInput, now = new Date()): Promise<AgentRun | null> => {
    const { status, result, error } = AgentRunFinishInputSchema.parse(input);
    const row = await db.update(agentRuns).set({
      status, resultJson: result ?? null, errorJson: error ?? null,
      finishedAt: now.toISOString(),
    }).where(and(eq(agentRuns.id, id), eq(agentRuns.status, "running"))).returning().get();
    return row ? toAgentRun(row) : null;
  };

  const listRunSteps = async (runId: string): Promise<AgentStepRecord[]> =>
    (await db.select().from(agentSteps).where(eq(agentSteps.runId, runId)).orderBy(asc(agentSteps.index)).all()).map(toAgentStep);

  return { createRun, appendStep, finishRun, listRunSteps };
};
