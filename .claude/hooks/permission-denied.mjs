#!/usr/bin/env node
// PermissionDenied: фіксує відмови в дозволах (класифікатор auto mode, deny-правила, відмови користувача)
// у .factory/guard-log.jsonl — щоб випадки, коли агента зупинили, не губились.
import * as core from '../../.factory/bin/core.mjs';
import { logControlEvent, readInput } from './lib/common.mjs';

const input = readInput();
let root;
try { root = core.projectRoot(); } catch { process.exit(0); }
const args = input.tool_input ?? {};
logControlEvent(root, {
  source: 'permission-denied',
  decision: 'denied',
  tool: input.tool_name ?? 'unknown',
  target: String(args.command ?? args.file_path ?? args.pattern ?? ''),
  reason: String(input.reason ?? input.message ?? input.permission_decision_reason ?? ''),
  agent: input.agent_type ?? 'main',
});
process.exit(0);
