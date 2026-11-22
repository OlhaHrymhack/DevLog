#!/usr/bin/env node
// SessionStart: відновлення контексту перерваної задачі зі збереженого стану.
import * as core from '../../.factory/bin/core.mjs';

let root;
try { root = core.projectRoot(); } catch { process.exit(0); }
const state = core.loadState(root);
const active = Object.values(state.tasks).filter((t) => !['BACKLOG', 'COMPLETED'].includes(t.status));
if (!active.length) process.exit(0);

const lines = ['[factory] Незавершені задачі (джерело: .factory/workflow-state.json):'];
for (const t of active) {
  lines.push(`- ${t.id} «${t.title}»: ${t.status}, tier ${core.effectiveTier(t) ?? '—'}, наступна дія: ${t.nextAction ?? '—'}${t.blockers.length ? `, блокери: ${t.blockers.join('; ')}` : ''}`);
}
lines.push(`Поточна: ${state.currentTask ?? '—'}. Повний звіт: node .factory/bin/factory.mjs report`);
process.stdout.write(`${lines.join('\n')}\n`);
