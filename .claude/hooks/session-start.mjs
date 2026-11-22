#!/usr/bin/env node
// SessionStart: відновлення контексту перерваної задачі зі збереженого стану
// + база коду для Stop hook (які файли коду були на старті цієї сесії, D-018).
import * as core from '../../.factory/bin/core.mjs';
import { readInput } from './lib/common.mjs';

const input = readInput();
let root;
try { root = core.projectRoot(); } catch { process.exit(0); }
try { core.ensureSessionBaseline(root, core.loadConfig(root), input.session_id); } catch { /* без бази Stop не блокує */ }
const state = core.loadState(root);
const active = Object.values(state.tasks).filter((t) => !['BACKLOG', 'COMPLETED'].includes(t.status));
if (!active.length) process.exit(0);

const lines = ['[factory] Незавершені задачі (джерело: .factory/workflow-state.json):'];
for (const t of active) {
  lines.push(`- ${t.id} «${t.title}»: ${t.status}, tier ${core.effectiveTier(t) ?? '—'}${t.blockers.length ? `, блокери: ${t.blockers.join('; ')}` : ''} → відновлення: factory resume ${t.id}`);
}
lines.push(`Поточна: ${state.currentTask ?? '—'}. Наступну дію визначає \`node .factory/bin/factory.mjs resume <ID>\` зі статусу, approval і результатів перевірок (збережений nextAction — лише нотатка).`);
process.stdout.write(`${lines.join('\n')}\n`);
