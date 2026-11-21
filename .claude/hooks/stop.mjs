#!/usr/bin/env node
// Stop: не дає завершити хід із незверифікованими змінами коду в IMPLEMENTING (один раз за хід).
import * as core from '../../.factory/bin/core.mjs';
import { readInput } from './lib/common.mjs';

const input = readInput();
if (input.stop_hook_active) process.exit(0);
let root;
try { root = core.projectRoot(); } catch { process.exit(0); }
const state = core.loadState(root);
const t = state.tasks[state.currentTask];
if (!t || t.status !== 'IMPLEMENTING') process.exit(0);

let tree;
try { tree = core.treeHash(root); } catch { process.exit(0); }
if (core.readEvidence(root, t.id, tree, 'verify')) process.exit(0);

process.stdout.write(JSON.stringify({
  decision: 'block',
  reason: `[factory] ${t.id}: є зміни коду без verify для поточного стану. Запусти \`node .factory/bin/factory.mjs verify ${t.id}\`, онови nextAction (factory next) і коротко звітуй користувачу.`,
}));
