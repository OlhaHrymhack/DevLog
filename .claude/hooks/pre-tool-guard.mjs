#!/usr/bin/env node
// PreToolUse: єдиний guard фабрики (секрети, деструктивні команди, цілісність записів,
// workflow gate, людські документи, модель Strong-агентів).
import * as core from '../../.factory/bin/core.mjs';
import { ask, deny, readInput } from './lib/common.mjs';
import * as rules from './lib/rules.mjs';

const input = readInput();
const tool = input.tool_name;
const args = input.tool_input ?? {};
let root;
try { root = core.projectRoot(); } catch { process.exit(0); }

const checks = [
  rules.checkSecrets,
  rules.checkDestructive,
  rules.checkFactoryIntegrity,
  rules.checkHumanDocs,
  rules.checkWorkflowGate,
  rules.checkAgentModel,
];

for (const check of checks) {
  let res;
  try { res = check(tool, args, root); } catch (e) { deny(`guard помилка (${check.name}): ${e.message}`); }
  if (res?.decision === 'deny') deny(res.reason);
  if (res?.decision === 'ask') ask(res.reason);
}
process.exit(0);
