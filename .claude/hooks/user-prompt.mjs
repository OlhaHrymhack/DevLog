#!/usr/bin/env node
// UserPromptSubmit: 1) лог промптів (з маскуванням секретів) для AGENT_LOG;
// 2) фіксація approvals. Approval можливий ЛИШЕ тут: цей hook бачить тільки текст, який ввела людина.
//    Формат: "APPROVE DEV-001" (план) або "APPROVE-FINAL DEV-001" (перед PR).
import fs from 'node:fs';
import path from 'node:path';
import * as core from '../../.factory/bin/core.mjs';
import { maskSecrets, readInput } from './lib/common.mjs';

const input = readInput();
const prompt = String(input.prompt ?? '');
let root;
try { root = core.projectRoot(); } catch { process.exit(0); }

if (prompt.trim()) {
  const log = path.join(root, '.claude', 'prompt-log.md');
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  fs.appendFileSync(log, `\n## ${stamp}\n\n${maskSecrets(prompt)}\n`);
}

const m = prompt.trim().match(/^APPROVE(-FINAL)?\s+([A-Z]+-\d+)\s*$/i);
if (!m) process.exit(0);

const kind = m[1] ? 'final' : 'plan';
const id = m[2].toUpperCase();
const state = core.loadState(root);
const task = state.tasks[id];
const say = (text) => { process.stdout.write(`[factory] ${text}\n`); process.exit(0); };

if (!task) say(`Approval не записано: задачі ${id} немає.`);
if (kind === 'plan') {
  if (task.status !== 'AWAITING_APPROVAL') say(`Approval плану не записано: ${id} у статусі ${task.status}, а не AWAITING_APPROVAL.`);
  const hash = core.planHash(root, id);
  if (!hash) say(`Approval не записано: немає .factory/task-plans/${id}.md.`);
  core.writeApproval(root, id, 'plan', { planHash: hash, by: 'user' });
  say(`Користувач погодив план ${id} (plan sha256 ${hash.slice(0, 10)}). Можна виконати: node .factory/bin/factory.mjs transition ${id} IMPLEMENTING. Якщо план зміниться — approval стане недійсним.`);
} else {
  if (task.status !== 'AWAITING_FINAL_APPROVAL') say(`Фінальний approval не записано: ${id} у статусі ${task.status}, а не AWAITING_FINAL_APPROVAL.`);
  const tree = core.treeHash(root);
  core.writeApproval(root, id, 'final', { tree, by: 'user' });
  say(`Користувач дав фінальний approval ${id} для стану коду ${tree.slice(0, 10)}. Будь-яка зміна коду зробить його недійсним. Далі: transition ${id} READY_FOR_PR → коміт → PR (без merge).`);
}
