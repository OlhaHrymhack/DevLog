import { describe, expect, it } from "vitest";
import { createAgentQuotaRepository, AGENT_RUN_QUOTA } from "../agentQuota/repository";
import { createAgentRunRepository } from "../agentRuns/repository";
import { createTaskRepository } from "../tasks/repository";
import { createDb } from "./client";
import { runDbCommand } from "./operations";

/**
 * Інтеграція з окремою віддаленою libSQL (sqld / Turso). Потрібен ізольований тестовий сервер:
 * `DEVLOG_TEST_LIBSQL_URL=http://127.0.0.1:8217` (тест скидає лічильник квоти `stuck-radar`). Без змінної набір не запускається.
 */
const REMOTE_URL = process.env.DEVLOG_TEST_LIBSQL_URL;
const NOW = new Date("2026-11-21T12:00:00Z");

describe.runIf(REMOTE_URL)("віддалена libSQL-база", () => {
  const target = { url: REMOTE_URL ?? "", authToken: process.env.DEVLOG_TEST_LIBSQL_TOKEN };

  it("DEV-017 AC-3: міграції й одноразовий seed виконуються окремою командою і повторно нічого не змінюють", async () => {
    expect(await runDbCommand("migrate", target, NOW)).toEqual({ command: "migrate", remote: true });
    expect(await runDbCommand("migrate", target, NOW)).toEqual({ command: "migrate", remote: true });
    await runDbCommand("seed-remote", target, NOW);
    expect(await runDbCommand("seed-remote", target, NOW)).toEqual({ command: "seed-remote", remote: true, tasks: 0 });

    const connection = await createDb(target.url, { authToken: target.authToken });
    try {
      const migrations = (await connection.client.execute("select count(*) as n from __drizzle_migrations")).rows[0]?.n;
      expect(migrations).toBe(2);
      expect((await createTaskRepository(connection.db).listTasks()).length).toBeGreaterThanOrEqual(1);
    } finally {
      connection.close();
    }
  });

  it("DEV-017 AC-3: CRUD, український пошук без регістру, каскад і транзакції на віддаленій базі", async () => {
    await runDbCommand("migrate", target, NOW);
    const connection = await createDb(target.url, { authToken: target.authToken });
    const repository = createTaskRepository(connection.db);
    const marker = `Їжак-${Date.now()}`;
    try {
      const task = await repository.createTask({ title: `${marker} у Ґанку`, description: "Перевірка 100% _сумісності_", status: "in-progress", priority: "high" }, NOW);
      expect((await repository.listTasks({ q: marker.toUpperCase() })).map((row) => row.id)).toEqual([task.id]);
      expect((await repository.listTasks({ q: `${marker.toLowerCase()} у ґАНКУ` })).map((row) => row.id)).toEqual([task.id]);
      await repository.addSubtasks(task.id, [{ title: "Перший", source: "user" }, { title: "Другий", source: "ai" }], NOW);
      await repository.addSubtasks(task.id, [{ title: "Третій", source: "user" }], NOW);
      expect((await repository.getTask(task.id))?.subtasks.map((subtask) => subtask.position)).toEqual([0, 1, 2]);
      await repository.addNote(task.id, { text: "Нотатка" }, NOW);
      await expect(repository.setFocus([task.id, "ghost-task"])).rejects.toThrow(/unknown/);

      const runs = createAgentRunRepository(connection.db);
      const run = await runs.createRun({ kind: "decompose", mode: "demo", taskId: task.id }, NOW);
      await Promise.all([1, 2, 3].map((index) => runs.appendStep(run.id, { type: "tool", label: `Крок ${index}`, state: "done" }, NOW)));
      expect((await runs.listRunSteps(run.id)).map((step) => step.index)).toEqual([0, 1, 2]);

      expect(await repository.deleteTask(task.id)).toBe(true);
      const left = await connection.client.execute({
        sql: "select (select count(*) from subtasks where task_id = ?) + (select count(*) from notes where task_id = ?) as n", args: [task.id, task.id],
      });
      expect(left.rows[0]?.n).toBe(0);
      expect((await runs.finishRun(run.id, { status: "result" }, NOW))?.taskId).toBeNull();
    } finally {
      connection.close();
    }
  });

  it("DEV-017 AC-4: паралельні резервування з незалежних клієнтів дають рівно 10 і переживають реконект", async () => {
    await runDbCommand("migrate", target, NOW);
    const admin = await createDb(target.url, { authToken: target.authToken });
    await admin.client.execute("delete from agent_quotas where kind = 'stuck-radar'");
    admin.close();

    const clients = await Promise.all(Array.from({ length: 12 }, () => createDb(target.url, { authToken: target.authToken })));
    try {
      const repositories = clients.map((client) => createAgentQuotaRepository(client.db));
      const results = await Promise.all([...repositories, ...repositories].map((quota) => quota.reserve("stuck-radar")));
      expect(results.filter((result) => result.reserved)).toHaveLength(AGENT_RUN_QUOTA);
    } finally {
      clients.forEach((client) => client.close());
    }

    const reconnected = await createDb(target.url, { authToken: target.authToken });
    try {
      const quota = createAgentQuotaRepository(reconnected.db);
      expect(await quota.getUsage("stuck-radar")).toBe(AGENT_RUN_QUOTA);
      expect(await quota.reserve("stuck-radar")).toEqual({ reserved: false });
    } finally {
      reconnected.close();
    }
  });
});
