#!/usr/bin/env node
// PreToolUse для конкретного subagent (підключається у frontmatter агента):
//   node path-guard.mjs <role>
// Обмежує, які файли роль може змінювати.
import * as core from '../../.factory/bin/core.mjs';
import { deny, readInput } from './lib/common.mjs';

const ROLE_GLOBS = {
  architect: ['.factory/task-plans/**'],
  qa: null, // береться з project.config.json → testGlobs
  docs: ['docs/vault/**'],
};

const role = process.argv[2];
const input = readInput();
if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(input.tool_name)) process.exit(0);
const root = core.projectRoot();
const rel = core.toRel(root, input.tool_input?.file_path ?? input.tool_input?.notebook_path);
const globs = ROLE_GLOBS[role] ?? core.loadConfig(root).testGlobs;
if (!core.matchesAny(rel, globs)) deny(`роль ${role} може змінювати лише: ${globs.join(', ')} (спроба: ${rel})`);
process.exit(0);
