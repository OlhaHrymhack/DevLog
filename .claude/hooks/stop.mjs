#!/usr/bin/env node
// Stop: не дає завершити хід, якщо САМЕ ЦЯ СЕСІЯ змінила код застосунку активної IMPLEMENTING-задачі
// і для поточного стану немає verify (один раз за хід). Сесія, що змінює лише фабрику / docs / .claude,
// не блокується (D-018): база — відбиток codeGlobs на старті сесії (SessionStart).
import * as core from '../../.factory/bin/core.mjs';
import { readInput } from './lib/common.mjs';

const input = readInput();
if (input.stop_hook_active) process.exit(0);
let root;
try { root = core.projectRoot(); } catch { process.exit(0); }
const state = core.loadState(root);
const t = state.tasks[state.currentTask];
if (!t || t.status !== 'IMPLEMENTING') process.exit(0);

let cfg;
try { cfg = core.loadConfig(root); } catch { process.exit(0); }
const baseline = core.readSessionBaseline(input.session_id);
if (!baseline || baseline.root !== root) {
  // Сесія почалась до цього hook-а: поточний стан — база; чужі зміни коду не приписуємо цій сесії.
  core.ensureSessionBaseline(root, cfg, input.session_id);
  process.exit(0);
}
if (core.codeFingerprint(root, cfg) === baseline.code) process.exit(0);

let tree;
try { tree = core.treeHash(root); } catch { process.exit(0); }
if (core.readEvidence(root, t.id, tree, 'verify') || core.readEvidence(root, t.id, tree, 'tests')) process.exit(0);

process.stdout.write(JSON.stringify({
  decision: 'block',
  reason: `[factory] ${t.id}: ця сесія змінила код без verify для поточного стану. Запусти \`node .factory/bin/factory.mjs verify ${t.id}\` і коротко звітуй користувачу.`,
}));
