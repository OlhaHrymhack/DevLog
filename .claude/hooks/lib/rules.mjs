// Правила guard-hook. Кожна функція повертає null (дозволено) або { decision: 'deny'|'ask', reason }.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as core from '../../../.factory/bin/core.mjs';
import { subcommands, tokenize } from './common.mjs';

// ---------- секрети ----------
const SECRET_PATH = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[^/]+$/,
  /\.(pem|key|p12|pfx|keystore)$/,
  /(^|\/)id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/,
  /(^|\/)credentials[^/]*$/i,
  /(^|\/)secrets?(\/|$)/i,
  /(^|\/)\.(ssh|aws|gnupg)(\/|$)/,
  /(^|\/)\.npmrc$/,
  /(^|\/)\.netrc$/,
];
const SECRET_CMD = [
  /\bprintenv\b/,
  /(^|[;&|]\s*)(env|set|export\s+-p)\s*($|[;&|])/,
  /process\.env/,
  /os\.environ/,
  /\$\{?[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\}?/,
  /\bgrep\b[^|;&]*\s-(\w*[rR]\w*)\b/, // рекурсивний grep ігнорує .gitignore і читає .env
];

export function isSecretPath(p) {
  const norm = String(p).replace(/^[<>=@]+/, '').replace(/\\/g, '/');
  return SECRET_PATH.some((re) => re.test(norm));
}

export function checkSecrets(tool, input) {
  const why = 'доступ до секретів заборонений (.env, ключі, credentials). Дозволено лише .env.example';
  if (['Read', 'Edit', 'Write', 'MultiEdit'].includes(tool) && isSecretPath(input.file_path)) return { decision: 'deny', reason: why };
  if (tool === 'NotebookEdit' && isSecretPath(input.notebook_path)) return { decision: 'deny', reason: why };
  if (tool === 'Grep' || tool === 'Glob') {
    const targets = [input.path, input.pattern, input.glob].filter(Boolean);
    if (targets.some(isSecretPath) || targets.some((t) => /\.env(?!\.example)/.test(t))) return { decision: 'deny', reason: why };
  }
  if (tool === 'Bash') {
    const cmd = input.command ?? '';
    if (tokenize(cmd).some(isSecretPath)) return { decision: 'deny', reason: why };
    if (SECRET_CMD.some((re) => re.test(cmd))) return { decision: 'deny', reason: `${why}. Також заборонено виводити змінні середовища та робити рекурсивний grep (використовуй Grep tool / rg — вони поважають .gitignore)` };
  }
  return null;
}

// ---------- деструктивні команди ----------
const SAFE_RM = new Set(['node_modules', '.next', 'dist', 'out', 'coverage', 'playwright-report', 'test-results', '.turbo']);

function realish(p) {
  // realpath найближчого існуючого предка: /var → /private/var на macOS, неіснуючий хвіст лишається як є
  let cur = p; const tail = [];
  while (!fs.existsSync(cur) && path.dirname(cur) !== cur) { tail.unshift(path.basename(cur)); cur = path.dirname(cur); }
  try { return path.join(fs.realpathSync(cur), ...tail); } catch { return p; }
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// tmp-ціль безпечна лише якщо вона строго всередині tmpdir і не всередині проєкту
// (проєкт сам може лежати в tmp — напр. selftest на Linux, де tmpdir = /tmp)
function isSafeTmpTarget(target, root) {
  const abs = realish(path.resolve(root, target));
  const projectRoot = realish(path.resolve(root));
  return isInside(abs, realish(os.tmpdir())) && abs !== projectRoot && !isInside(abs, projectRoot);
}

function gitArgs(argv) { return argv[0] === 'git' ? argv.slice(1).filter((a) => !a.startsWith('-C')) : null; }

function protectedBranches(root) {
  try { return core.loadConfig(root).branches?.protected ?? ['main', 'master']; } catch { return ['main', 'master']; }
}

export function checkDestructive(tool, input, root) {
  if (tool !== 'Bash') return null;
  const cmd = input.command ?? '';
  const branches = protectedBranches(root);
  const branchRe = new RegExp(`^(\\S+:)?(refs/heads/)?(${branches.join('|')})$`);
  for (const argv of subcommands(cmd)) {
    const g = gitArgs(argv);
    if (g) {
      const [sub, ...a] = g;
      if (sub === 'push' && a.some((x) => x === '--force' || x === '-f' || x.startsWith('--force-with-lease') || x.startsWith('+'))) return { decision: 'deny', reason: 'force push заборонений' };
      if (sub === 'commit') {
        let current = '';
        try { current = core.git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch { /* немає комітів */ }
        if (branches.includes(current)) return { decision: 'deny', reason: `коміт прямо в ${current} заборонений — створи фіча-гілку від stage і відкрий PR` };
      }
      const refspecs = a.filter((x) => !x.startsWith('-')).slice(1);
      if (sub === 'push' && !refspecs.length) {
        let current = '';
        try { current = core.git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch { /* немає комітів */ }
        if (branches.includes(current)) return { decision: 'deny', reason: `push з захищеної гілки ${current} заборонений — створи фіча-гілку` };
      }
      if (sub === 'push' && a.some((x) => branchRe.test(x))) return { decision: 'deny', reason: `прямий push у ${branches.join('/')} заборонений — лише фіча-гілка + PR; merge робить користувач` };
      if (sub === 'reset' && a.includes('--hard')) return { decision: 'deny', reason: 'git reset --hard заборонений без окремого дозволу' };
      if (sub === 'clean' && a.some((x) => /^-\w*f/.test(x))) return { decision: 'deny', reason: 'git clean -f заборонений' };
      if ((sub === 'checkout' || sub === 'restore') && a.includes('.')) return { decision: 'deny', reason: 'масове відкочування змін заборонене' };
      if (sub === 'branch' && a.some((x) => x === '-D' || x === '--delete' && a.includes('--force'))) return { decision: 'deny', reason: 'примусове видалення гілки заборонене' };
      if (sub === 'stash' && ['drop', 'clear'].includes(a[0])) return { decision: 'deny', reason: 'видалення stash заборонене' };
      if (sub === 'commit' && a.some((x) => x === '--no-verify' || /^-[a-zA-Z]*n[a-zA-Z]*$/.test(x))) return { decision: 'deny', reason: 'обхід перевірок (--no-verify) заборонений' };
      if (sub === 'config' && a.some((x) => x === 'core.hooksPath') && !(a.includes('.githooks'))) return { decision: 'deny', reason: 'зміна core.hooksPath заборонена' };
      if (sub === 'update-ref' || sub === 'filter-branch' || (sub === 'rebase' && a.includes('--root'))) return { decision: 'deny', reason: 'переписування історії заборонене' };
    }
    if (argv[0] === 'gh' && argv[1] === 'pr' && argv[2] === 'create') {
      let integration = 'stage';
      try { integration = core.loadConfig(root).branches?.integration ?? 'stage'; } catch { /* default */ }
      const i = argv.findIndex((x) => x === '--base' || x === '-B');
      const base = i >= 0 ? argv[i + 1] : (argv.find((x) => x.startsWith('--base='))?.slice(7) ?? null);
      if (base !== integration) return { decision: 'deny', reason: `PR відкривається лише в ${integration}: додай --base ${integration}` };
    }
    if (argv[0] === 'gh' && argv[1] === 'pr' && argv[2] === 'merge') return { decision: 'deny', reason: 'автоматичний merge заборонений — merge робить лише користувач' };
    if (argv[0] === 'gh' && argv[1] === 'api' && argv.some((x) => /merge|protection/.test(x))) return { decision: 'ask', reason: 'gh api зачіпає merge/branch protection — потрібне підтвердження' };
    if (argv[0] === 'rm' && argv.some((x) => /^-\w*[rR]/.test(x))) {
      const targets = argv.slice(1).filter((x) => !x.startsWith('-'));
      const safe = targets.length && targets.every((t) => SAFE_RM.has(t.replace(/\/$/, '')) || isSafeTmpTarget(t, root));
      if (!safe) return { decision: 'deny', reason: `рекурсивне видалення дозволене лише для ${[...SAFE_RM].join(', ')} або tmp` };
    }
  }
  if (/\bHUSKY=0\b|\bSKIP_FACTORY\b|FACTORY_ROOT=/.test(cmd)) return { decision: 'deny', reason: 'обхід gates через змінні середовища заборонений' };
  return null;
}

// ---------- захищені файли фабрики ----------
const FACTORY_RECORDS = ['.factory/approvals', '.factory/evidence', '.factory/workflow-state.json'];
const FACTORY_CODE = ['.factory/bin/', '.claude/hooks/', '.claude/settings.json', '.githooks/', '.factory/project.config.json'];

export function checkFactoryIntegrity(tool, input, root) {
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const rel = core.toRel(root, input.file_path ?? input.notebook_path);
    if (FACTORY_RECORDS.some((p) => rel === p || rel.startsWith(`${p}/`))) return { decision: 'deny', reason: `${rel} змінюється лише через node .factory/bin/factory.mjs (approvals — лише з промпту користувача)` };
    if (FACTORY_CODE.some((p) => rel === p.replace(/\/$/, '') || rel.startsWith(p))) return { decision: 'ask', reason: `зміна механізмів контролю фабрики (${rel}) — потрібне підтвердження користувача` };
  }
  if (tool === 'Bash') {
    const cmd = input.command ?? '';
    const viaCli = /^\s*node\s+\.factory\/bin\/factory\.mjs\b/.test(cmd) && !/[;&|]/.test(cmd.replace(/\|\|?\s*true\s*$/, ''));
    // staging/читання git не змінює вміст записів: одна команда, без ланцюжків, перенаправлень, підстановок і --output
    const gitStaging = /^\s*git\s+(add|diff|log|show|status|commit)\b/.test(cmd) && !/[;&|<>`]|\$\(|--output/.test(cmd);
    if (!viaCli && !gitStaging &&(FACTORY_RECORDS.some((p) => cmd.includes(p)) || /user-prompt\.mjs|writeApproval/.test(cmd))) {
      return { decision: 'deny', reason: 'записи фабрики (state/evidence/approvals) змінюються лише через factory.mjs; для читання — factory status/report' };
    }
  }
  return null;
}

// ---------- workflow gate: код лише в межах погодженої задачі ----------
export function checkWorkflowGate(tool, input, root) {
  if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) return null;
  let cfg; try { cfg = core.loadConfig(root); } catch { return null; }
  const rel = core.toRel(root, input.file_path ?? input.notebook_path);
  if (!core.matchesAny(rel, cfg.codeGlobs)) return null;
  const state = core.loadState(root);
  const id = state.currentTask;
  if (!id || !state.tasks[id]) return { decision: 'deny', reason: `зміна коду (${rel}) без задачі. Запусти /factory і веди зміну через задачу` };
  const t = state.tasks[id];
  if (t.status !== 'IMPLEMENTING') return { decision: 'deny', reason: `${id} у статусі ${t.status}; код змінюється лише в IMPLEMENTING` };
  const a = core.approvalStatus(root, t);
  if (!a.ok) return { decision: 'deny', reason: `${id}: ${a.detail}` };
  return null;
}

// ---------- документи, які пише лише людина / append-only ----------
function sectionOf(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.includes(heading));
  if (start === -1) return null;
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l) && l.match(/^#+/)[0].length <= level);
  if (end === -1) end = lines.length;
  return lines.slice(start, end).join('\n');
}

function proposedContent(tool, input, current) {
  if (tool === 'Write') return input.content ?? '';
  if (tool === 'Edit') {
    if (!current.includes(input.old_string)) return null;
    return input.replace_all ? current.split(input.old_string).join(input.new_string) : current.replace(input.old_string, input.new_string);
  }
  if (tool === 'MultiEdit') {
    let c = current;
    for (const e of input.edits ?? []) { if (!c.includes(e.old_string)) return null; c = e.replace_all ? c.split(e.old_string).join(e.new_string) : c.replace(e.old_string, e.new_string); }
    return c;
  }
  return null;
}

export function checkHumanDocs(tool, input, root) {
  if (!['Edit', 'Write', 'MultiEdit'].includes(tool)) return null;
  let cfg; try { cfg = core.loadConfig(root); } catch { return null; }
  const rel = core.toRel(root, input.file_path);
  const abs = path.join(root, rel);
  const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
  if (cfg.humanOnly.files.includes(rel)) return { decision: 'deny', reason: `${rel} пише лише автор (вимога ТЗ). Можна запропонувати факти в чаті` };
  for (const s of cfg.humanOnly.sections.filter((x) => x.file === rel)) {
    const next = proposedContent(tool, input, current);
    if (next === null) continue;
    if (sectionOf(current, s.heading) !== sectionOf(next, s.heading)) return { decision: 'deny', reason: `розділ «${s.heading}» у ${rel} пише лише автор, без AI` };
  }
  if (cfg.appendOnly.includes(rel) && current) {
    const next = proposedContent(tool, input, current);
    if (next === null || !next.startsWith(current.replace(/\s+$/, ''))) return { decision: 'deny', reason: `${rel} — append-only журнал: дозволено лише дописувати в кінець` };
  }
  return null;
}

// ---------- незнижувана модель для Strong-агентів ----------
export function checkAgentModel(tool, input, root) {
  if (tool !== 'Agent' && tool !== 'Task') return null;
  let cfg; try { cfg = core.loadConfig(root); } catch { return null; }
  if (cfg.pinnedStrongAgents.includes(input.subagent_type) && input.model && input.model !== 'opus') {
    return { decision: 'deny', reason: `${input.subagent_type} обов'язково працює на opus; зниження моделі лише з дозволу користувача` };
  }
  if (input.subagent_type === 'reviewer' && input.model) {
    const state = core.loadState(root);
    const task = state.currentTask ? state.tasks[state.currentTask] : null;
    const need = core.requiredReviewModel(cfg, task?.tier ?? 'strong');
    if (core.modelRank(input.model) < core.modelRank(need)) {
      return { decision: 'deny', reason: `reviewer для tier ${task?.tier ?? '—'} має працювати щонайменше на ${need}` };
    }
  }
  return null;
}
