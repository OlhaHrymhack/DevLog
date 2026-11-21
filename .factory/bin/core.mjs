// Ядро фабрики: стан задач, approvals, evidence, tree hash, gates.
// Без зовнішніх залежностей. Використовується CLI (factory.mjs) і hooks (.claude/hooks).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const STATUSES = [
  'BACKLOG', 'DISCOVERY', 'PLANNING', 'AWAITING_APPROVAL', 'IMPLEMENTING', 'REVIEWING',
  'TESTING', 'QA', 'AWAITING_FINAL_APPROVAL', 'READY_FOR_PR', 'COMPLETED', 'BLOCKED',
];

export const TRANSITIONS = {
  BACKLOG: ['DISCOVERY'],
  DISCOVERY: ['PLANNING'],
  PLANNING: ['AWAITING_APPROVAL', 'IMPLEMENTING'],
  AWAITING_APPROVAL: ['IMPLEMENTING', 'PLANNING'],
  IMPLEMENTING: ['REVIEWING', 'PLANNING'],
  REVIEWING: ['TESTING', 'IMPLEMENTING'],
  TESTING: ['QA', 'AWAITING_FINAL_APPROVAL', 'IMPLEMENTING'], // → AWAITING_FINAL_APPROVAL лише для fast (без QA)
  QA: ['AWAITING_FINAL_APPROVAL', 'IMPLEMENTING'],
  AWAITING_FINAL_APPROVAL: ['READY_FOR_PR', 'IMPLEMENTING'],
  READY_FOR_PR: ['COMPLETED', 'IMPLEMENTING'],
  COMPLETED: [],
  BLOCKED: [],
};

// Які gates мають бути зелені для поточного tree, щоб увійти в статус.
export const REQUIRED_GATES = {
  IMPLEMENTING: ['approval'],
  REVIEWING: ['approval', 'verify'],
  TESTING: ['approval', 'verify', 'review', 'security'],
  QA: ['approval', 'verify', 'review', 'security', 'tests'],
  AWAITING_FINAL_APPROVAL: ['approval', 'verify', 'review', 'security', 'tests', 'qa'],
  READY_FOR_PR: ['approval', 'verify', 'review', 'security', 'tests', 'qa', 'final'],
};

export const TIERS = ['fast', 'balanced', 'strong'];
export const TIER_MODEL = { fast: 'haiku', balanced: 'sonnet', strong: 'opus' };
export const CRITERIA = ['modules', 'architecture', 'criticality', 'security', 'integrations', 'migrations', 'state', 'uncertainty'];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const BLOCKING = new Set(['critical', 'high']);
const TREE_EXCLUDES = ['.factory', 'docs/vault'];

// ---------- paths / io ----------
export function projectRoot() {
  if (process.env.FACTORY_ROOT) return process.env.FACTORY_ROOT;
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

export function paths(root) {
  const f = path.join(root, '.factory');
  return {
    factory: f,
    config: path.join(f, 'project.config.json'),
    state: path.join(f, 'workflow-state.json'),
    approvals: path.join(f, 'approvals'),
    evidence: path.join(f, 'evidence'),
    plans: path.join(f, 'task-plans'),
  };
}

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function loadConfig(root) {
  const cfg = readJson(paths(root).config);
  if (!cfg) throw new Error('Немає .factory/project.config.json');
  return cfg;
}

export function sha256(text) { return createHash('sha256').update(text).digest('hex'); }
export function now() { return new Date().toISOString(); }

// ---------- globs ----------
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(rel, globs = []) {
  return globs.some((g) => globToRegExp(g).test(rel));
}

export function toRel(root, p) {
  if (!p) return '';
  const abs = path.isAbsolute(p) ? p : path.resolve(root, p);
  return path.relative(root, abs).split(path.sep).join('/');
}

// ---------- git ----------
export function git(root, args, env) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Hash дерева без службових файлів фабрики (.factory, docs/vault).
 * source: 'worktree' (усі не-ignored файли), 'index' (staged), 'HEAD'.
 * Будь-яка зміна коду → новий hash → evidence для старого hash стає застарілим.
 */
export function treeHash(root, source = 'worktree') {
  const tmp = path.join(os.tmpdir(), `factory-idx-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const env = { ...process.env, GIT_INDEX_FILE: tmp };
  try {
    if (source === 'index') {
      const gitDir = path.resolve(root, git(root, ['rev-parse', '--git-dir']).trim());
      const idx = path.join(gitDir, 'index');
      if (fs.existsSync(idx)) fs.copyFileSync(idx, tmp);
    } else if (source === 'HEAD') {
      git(root, ['read-tree', 'HEAD'], env);
    } else {
      git(root, ['add', '-A', '--', '.'], env);
    }
    git(root, ['rm', '-r', '--cached', '-q', '--ignore-unmatch', '--', ...TREE_EXCLUDES], env);
    return git(root, ['write-tree'], env).trim();
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// ---------- state ----------
export function loadState(root) {
  return readJson(paths(root).state, { version: 1, currentTask: null, tasks: {} });
}

export function saveState(root, state) { writeJsonAtomic(paths(root).state, state); }

export function getTask(state, id) {
  const t = state.tasks[id];
  if (!t) throw new Error(`Задачу ${id} не знайдено. Додай: factory add ${id} "<назва>"`);
  return t;
}

export function pushHistory(task, entry) {
  task.history.push({ at: now(), ...entry });
  task.updatedAt = now();
}

// ---------- plans / approvals ----------
export function planFile(root, id) { return path.join(paths(root).plans, `${id}.md`); }

export function planHash(root, id) {
  const f = planFile(root, id);
  return fs.existsSync(f) ? sha256(fs.readFileSync(f, 'utf8')) : null;
}

export function approvalFile(root, id, kind) { return path.join(paths(root).approvals, `${id}.${kind}.json`); }
export function readApproval(root, id, kind) { return readJson(approvalFile(root, id, kind)); }

/** Викликається ТІЛЬКИ з UserPromptSubmit hook (тобто з промпту людини). */
export function writeApproval(root, id, kind, data) {
  writeJsonAtomic(approvalFile(root, id, kind), { taskId: id, kind, at: now(), ...data });
}

export function acceptanceCriteria(root, id) {
  const f = planFile(root, id);
  if (!fs.existsSync(f)) return [];
  const ids = fs.readFileSync(f, 'utf8').match(/\bAC-\d+\b/g) ?? [];
  return [...new Set(ids)];
}

// ---------- evidence ----------
export function evidenceFile(root, id, tree, kind) { return path.join(paths(root).evidence, id, tree, `${kind}.json`); }
export function readEvidence(root, id, tree, kind) { return readJson(evidenceFile(root, id, tree, kind)); }
export function writeEvidence(root, id, tree, kind, data) {
  const file = evidenceFile(root, id, tree, kind);
  writeJsonAtomic(file, { taskId: id, kind, tree, at: now(), ...data });
  return file;
}

export function hasStaleEvidence(root, id, tree, kind) {
  const dir = path.join(paths(root).evidence, id);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((t) => t !== tree && fs.existsSync(path.join(dir, t, `${kind}.json`)));
}

export function blockingFindings(ev) {
  return (ev?.findings ?? []).filter((f) => BLOCKING.has(f.severity));
}

/** Перевірка структури звіту reviewer/security/qa. Повертає масив помилок. */
export function validateFindingsReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object') return ['звіт має бути JSON-об\'єктом'];
  for (const k of ['agent', 'model', 'summary']) if (typeof report[k] !== 'string' || !report[k]) errors.push(`поле "${k}" обов'язкове`);
  if (!Array.isArray(report.findings)) errors.push('поле "findings" має бути масивом');
  else report.findings.forEach((f, i) => {
    if (!SEVERITIES.includes(f?.severity)) errors.push(`findings[${i}].severity має бути одним із ${SEVERITIES.join('/')}`);
    if (typeof f?.title !== 'string' || !f.title) errors.push(`findings[${i}].title обов'язковий`);
  });
  return errors;
}

// ---------- AC traceability ----------
export function listProjectFiles(root) {
  const out = git(root, ['ls-files', '--cached', '--others', '--exclude-standard']);
  return out.split('\n').filter(Boolean);
}

export function untracedCriteria(root, id, cfg) {
  const acs = acceptanceCriteria(root, id);
  if (!acs.length) return [];
  const tests = listProjectFiles(root).filter((f) => matchesAny(f, cfg.testGlobs));
  const corpus = tests.map((f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } }).join('\n');
  return acs.filter((ac) => !new RegExp(`\\b${ac}\\b`).test(corpus));
}

// ---------- gates ----------
export function approvalStatus(root, task) {
  if (task.tier === 'fast') return { ok: true, detail: 'Fast-задача: approval не потрібен' };
  const a = readApproval(root, task.id, 'plan');
  if (!a) return { ok: false, detail: 'немає approval плану (користувач має написати: APPROVE ' + task.id + ')' };
  if (a.planHash !== planHash(root, task.id)) return { ok: false, detail: 'план змінився після approval → потрібне повторне погодження' };
  return { ok: true, detail: `погоджено ${a.at}` };
}

export function evaluateGate(root, cfg, task, tree, gate) {
  const stale = (kind) => (hasStaleEvidence(root, task.id, tree, kind) ? ' (є застарілий результат для іншого стану коду)' : '');
  switch (gate) {
    case 'approval': return approvalStatus(root, task);
    case 'verify': {
      const ev = readEvidence(root, task.id, tree, 'verify');
      if (!ev) return { ok: false, pending: true, detail: 'verify не запускався для поточного коду' + stale('verify') };
      return { ok: ev.ok, detail: ev.ok ? 'typecheck/lint/unit — passed' : `failed: ${ev.failed.join(', ')}` };
    }
    case 'tests': {
      const ev = readEvidence(root, task.id, tree, 'tests');
      if (!ev) return { ok: false, pending: true, detail: 'повний прогін тестів (verify --full) не запускався' + stale('tests') };
      if (!ev.ok) return { ok: false, detail: `failed: ${ev.failed.join(', ')}` };
      const missing = untracedCriteria(root, task.id, cfg);
      if (missing.length) return { ok: false, detail: `AC без тестів: ${missing.join(', ')}` };
      return { ok: true, detail: 'unit + e2e passed, усі AC покриті' };
    }
    case 'qa':
      if (task.tier === 'fast') return { ok: true, detail: 'Fast-задача: етап QA пропускається (рішення D-005)' };
    // falls through
    case 'review':
    case 'security': {
      if (gate === 'security' && !task.securityRequired) return { ok: true, detail: 'не потрібен за оцінкою ризику' };
      const ev = readEvidence(root, task.id, tree, gate);
      if (!ev) return { ok: false, pending: true, detail: `${gate} не проведено для поточного коду` + stale(gate) };
      const b = blockingFindings(ev);
      if (b.length) return { ok: false, detail: `${b.length} блокувальних findings (${b.map((f) => f.severity).join(', ')})` };
      const cross = cfg.crossFamilyReview;
      if (gate === 'review' && cross?.enabled && cross.tiers.includes(task.tier)) {
        const cx = readEvidence(root, task.id, tree, 'codex');
        if (!cx) return { ok: false, pending: true, detail: `Claude-review ок; потрібне друге рев'ю іншою модельною сім'єю (codex) для tier ${task.tier}` + stale('codex') };
        const cb = blockingFindings(cx);
        if (cb.length) return { ok: false, detail: `codex: ${cb.length} блокувальних findings` };
        return { ok: true, detail: `reviewer (${ev.model}) + codex (${cx.model}): блокувальних немає` };
      }
      return { ok: true, detail: `${ev.findings.length} findings, блокувальних немає (${ev.agent}/${ev.model})` };
    }
    case 'final': {
      const a = readApproval(root, task.id, 'final');
      if (!a) return { ok: false, pending: true, detail: 'немає фінального approval (APPROVE-FINAL ' + task.id + ')' };
      if (a.tree !== tree) return { ok: false, detail: 'код змінився після фінального approval → потрібне повторне погодження' };
      return { ok: true, detail: `погоджено ${a.at}` };
    }
    default: throw new Error(`Невідомий gate: ${gate}`);
  }
}

export function evaluateGates(root, cfg, task, tree, gates) {
  return gates.map((g) => ({ gate: g, ...evaluateGate(root, cfg, task, tree, g) }));
}

// ---------- complexity / escalation ----------
export function classify(scores) {
  for (const c of CRITERIA) {
    if (![0, 1, 2].includes(scores[c])) throw new Error(`Критерій "${c}" має бути 0, 1 або 2`);
  }
  const sum = CRITERIA.reduce((s, c) => s + scores[c], 0);
  let tier = sum <= 3 ? 'fast' : sum <= 8 ? 'balanced' : 'strong';
  if (scores.security === 2 || scores.integrations === 2) tier = 'strong';
  const securityRequired = scores.security >= 1 || scores.integrations >= 1;
  return { sum, tier, securityRequired, requiresApproval: tier !== 'fast', requiresEngReview: tier === 'strong' };
}

/** Фіксує провал спроби; повертає опис дії (ескалація / блок). */
export function recordFailure(task, cfg, stage) {
  const { failuresBeforeTierUp, failuresOnStrongBeforeBlock } = cfg.escalation;
  task.attempts[task.tier] = (task.attempts[task.tier] ?? 0) + 1;
  const n = task.attempts[task.tier];
  if (task.tier !== 'strong' && n >= failuresBeforeTierUp) {
    const from = task.tier;
    task.tier = TIERS[TIERS.indexOf(from) + 1];
    task.model = TIER_MODEL[task.tier];
    pushHistory(task, { event: 'escalation', from, to: task.tier, note: `${n} провали на ${stage}` });
    return `Ескалація: ${from} → ${task.tier} (developer тепер на ${task.model})`;
  }
  if (task.tier === 'strong' && n >= failuresOnStrongBeforeBlock) {
    task.blockedFrom = task.status;
    task.status = 'BLOCKED';
    task.blockers.push(`${n} провали на Strong (${stage}) — потрібне рішення користувача`);
    pushHistory(task, { event: 'blocked', note: `${n} провали на Strong` });
    return 'Задачу заблоковано: потрібне рішення користувача';
  }
  return `Спроба ${n} на рівні ${task.tier} невдала`;
}
