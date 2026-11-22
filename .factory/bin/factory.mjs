#!/usr/bin/env node
// CLI фабрики. Єдиний спосіб змінювати .factory/workflow-state.json і evidence.
// Використання: node .factory/bin/factory.mjs <command> [...]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from './core.mjs';

const HELP = `Команди:
  init                                   створити state, якщо його немає
  add <ID> <назва...>                    додати задачу в BACKLOG
  start <ID>                             BACKLOG → DISCOVERY, зробити поточною
  classify <ID> modules=0..2 architecture=.. criticality=.. security=.. integrations=.. migrations=.. state=.. uncertainty=.. ui=0|1
                                         оцінити складність (потрібен task-plans/<ID>.md), обрати tier/модель
  transition <ID> <STATUS> [--agent A] [--note "..."]   перехід з перевіркою gates
  verify <ID> [--full]                   typecheck/lint/unit + AC traceability (+e2e з --full), записати evidence
  record <ID> <review|codex|security|qa> <file.json>    записати звіт агента
  escalate <ID> <причина...>             підвищити модель developer (tier і рівень рев'ю не змінюються)
  line [ID]                              один рядок статусу (між етапами замість report)
  resume [ID]                            відновити задачу: модель за балами, наступна дія з gates, чи можна продовжувати
  usage <ID> <role> <tokens>             записати токени субагента · metrics [ID] — токени, цикли, час до PR
  retitle <ID> <назва...> | remove <ID>  (remove — лише для BACKLOG)
  issue <ID> <текст> | next <ID> <текст> | pr <ID> <url>
  block <ID> <причина> | unblock <ID>
  gates [ID] [--stage worktree|pre-commit|pre-push]     перевірити gates (exit 1 якщо не пройдені)
  status [ID] | report [ID] | tree [--stage index]
  selftest                               автоматичні сценарії перевірки фабрики`;

const root = core.projectRoot();
const [cmd, ...rest] = process.argv.slice(2);

function flags(args) {
  const pos = []; const opt = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const k = args[i].slice(2);
      if (args[i + 1] !== undefined && !args[i + 1].startsWith('--')) opt[k] = args[++i]; else opt[k] = true;
    } else pos.push(args[i]);
  }
  return { pos, opt };
}

function fail(msg, code = 1) { console.error(`✖ ${msg}`); process.exit(code); }
function ok(msg) { console.log(`✔ ${msg}`); }

function withState(fn) {
  const state = core.loadState(root);
  const result = fn(state);
  core.saveState(root, state);
  return result;
}

function newTask(id, title) {
  return {
    id, title, status: 'BACKLOG', tier: null, model: null, scores: null, securityRequired: false,
    agent: null, attempts: {}, issues: [], blockers: [], nextAction: 'start', pr: null,
    history: [], createdAt: core.now(), updatedAt: core.now(),
  };
}

function gateLine(g) {
  const icon = g.ok ? '✅' : g.pending ? '⏳' : '❌';
  return `- ${icon} ${g.gate}: ${g.detail}`;
}

const GATE_TITLES = { approval: 'Gate 1 Approval', verify: 'Gate 2 Verify (код + тести)', review: 'Gate 3 Review', security: 'Gate 4 Security', tests: 'Gate 5 E2E', qa: 'QA', final: 'Gate 6 Final approval' };

/** Рядок старту / зміни етапу: Task ID, tier, хто і на чому реалізує, модель рев'ю, наступна дія. */
function line(t, cfg) {
  const tier = core.effectiveTier(t);
  const impl = core.implementer(t);
  const rev = tier ? core.requiredReviewModel(cfg, t) : null;
  const lastReview = [...t.history].reverse().find((e) => e.event === 'review' && e.model);
  const confirmed = rev && lastReview && core.modelRank(lastReview.model) >= core.modelRank(rev);
  const legacy = t.tier && tier && t.tier !== tier ? ` (збережений ${t.tier} — стара ескалація, на рев'ю не впливає)` : '';
  return [
    t.id, t.status,
    `tier ${tier ?? 'не оцінено'}${legacy}`,
    `реалізація: ${impl ? `${impl.who} ${impl.model} (заплановано)` : '—'}`,
    `рев'ю: ${rev ? `${rev} (${confirmed ? `підтверджено звітом ${lastReview.model}` : 'заплановано'})` : '—'}`,
    `далі: ${deriveNext(t, cfg)}`,
  ].join(' · ') + (impl?.who === 'developer' && t.status === 'IMPLEMENTING' ? ' · перебіг subagent: /tasks' : '');
}

const ALL_GATES = ['approval', 'verify', 'review', 'security', 'tests', 'qa', 'final'];

/**
 * Наступна дія зі статусу, approval і результатів перевірок для поточного tree (D-018).
 * Збережений nextAction не використовується: старий запис не може зупинити роботу.
 */
function deriveNext(t, cfg, tree = core.treeHash(root)) {
  const id = t.id;
  const impl = core.implementer(t);
  const who = impl ? `${impl.who} (${impl.model})` : 'developer';
  const g = Object.fromEntries(core.evaluateGates(root, cfg, t, tree, ALL_GATES).map((x) => [x.gate, x]));
  switch (t.status) {
    case 'BACKLOG': return `start ${id}`;
    case 'DISCOVERY': return `контекст за маршрутом (спека docs/vault/specs/${id}.md, якщо є) → transition ${id} PLANNING`;
    case 'PLANNING':
      if (!fs.existsSync(core.planFile(root, id))) return `план .factory/task-plans/${id}.md (AC і прототип зі специфікації) → classify ${id} … ui=0|1`;
      if (!t.scores) return `classify ${id} … ui=0|1`;
      return core.effectiveTier(t) === 'fast' ? `transition ${id} IMPLEMENTING` : `transition ${id} AWAITING_APPROVAL і показати план користувачу`;
    case 'AWAITING_APPROVAL': return g.approval.ok ? `transition ${id} IMPLEMENTING` : `чекаємо від користувача: APPROVE ${id}`;
    case 'IMPLEMENTING':
      if (!g.approval.ok) return `${g.approval.detail} → transition ${id} PLANNING`;
      if (g.verify.ok) return `transition ${id} REVIEWING --agent reviewer`;
      if (!g.verify.pending) return `${who} виправляє: ${g.verify.detail} → verify ${id}`;
      return `${who} продовжує реалізацію і тести на кожен AC → verify ${id}`;
    case 'REVIEWING': {
      const todo = [];
      if (g.review.pending) todo.push(/codex/.test(g.review.detail) ? 'codex review' : `reviewer (${core.requiredReviewModel(cfg, t)})`);
      if (g.security.pending) todo.push('security (opus)');
      if (todo.length) return `${todo.join(' + ')} для одного хешу${t.reviewTree ? ` ${t.reviewTree.slice(0, 10)}` : ''}, дочекайся всіх → record ${id} …`;
      const failing = ['review', 'security'].filter((k) => !g[k].ok);
      if (failing.length) return `transition ${id} IMPLEMENTING → ${who} виправляє findings (${failing.join(' + ')}) одним пакетом, потім verify ${id}`;
      if (core.qaRequired(t)) return `transition ${id} QA --agent qa`;
      if (!g.tests.ok) return `verify ${id} --full (E2E за специфікацією) → transition ${id} AWAITING_FINAL_APPROVAL`;
      return `transition ${id} AWAITING_FINAL_APPROVAL`;
    }
    case 'QA':
      if (!g.tests.ok) return g.tests.pending ? `verify ${id} --full` : `transition ${id} IMPLEMENTING → ${who} виправляє: ${g.tests.detail}`;
      if (!g.qa.ok) return g.qa.pending ? `qa → record ${id} qa` : `transition ${id} IMPLEMENTING → ${who} виправляє QA findings`;
      return `transition ${id} AWAITING_FINAL_APPROVAL`;
    case 'AWAITING_FINAL_APPROVAL': return g.final.ok ? `transition ${id} READY_FOR_PR` : `report ${id}; чекаємо від користувача: APPROVE-FINAL ${id}`;
    case 'READY_FOR_PR': return t.pr ? `transition ${id} COMPLETED` : `коміт, push фіча-гілки, PR у stage → pr ${id} <url>`;
    case 'COMPLETED': return `docs + metrics ${id}`;
    case 'BLOCKED': return `блокер: ${t.blockers.join('; ') || '—'} → рішення користувача, потім unblock ${id}`;
    default: return t.nextAction ?? '—';
  }
}

/**
 * Перехід із перевіркою правил і gates (спільний для transition і resume).
 * Повертає текст помилки або null; при успіху змінює t.
 */
function applyTransition(t, to, cfg, opt = {}) {
  const id = t.id;
  if (t.status === 'BLOCKED') return 'задача BLOCKED — спершу unblock';
  if (!core.TRANSITIONS[t.status].includes(to)) return `перехід ${t.status} → ${to} заборонений. Дозволено: ${core.TRANSITIONS[t.status].join(', ') || '—'}`;
  if (t.status === 'COMPLETED') {
    // Повторне рев'ю після завершення: PR ще не злитий, а код змінився (ребейз на stage). Без зміни коду фінальне погодження чинне.
    const tree = core.treeHash(root);
    if (core.evaluateGates(root, cfg, t, tree, ['final']).every((g) => g.ok)) return 'код не змінився після APPROVE-FINAL — повторне рев\'ю не потрібне';
    const failed = core.evaluateGates(root, cfg, t, tree, core.REQUIRED_GATES.REVIEWING).filter((g) => !g.ok);
    if (failed.length) return `gates не пройдені для ${to}:\n${failed.map(gateLine).join('\n')}`;
  }
  if (to === 'IMPLEMENTING' && !t.tier) return 'спершу classify';
  if (to === 'IMPLEMENTING' && t.status === 'PLANNING' && core.effectiveTier(t) !== 'fast') return 'задача не Fast → спершу AWAITING_APPROVAL';
  if (t.status === 'REVIEWING' && to === 'AWAITING_FINAL_APPROVAL' && core.qaRequired(t)) return 'UI-задача balanced/strong → спершу QA';
  if (to === 'COMPLETED' && !t.pr) return 'немає PR reference (factory pr <ID> <url>)';
  const required = core.REQUIRED_GATES[to] ?? [];
  // Повернення назад (на доопрацювання) gates не вимагає.
  const forward = core.STATUSES.indexOf(to) > core.STATUSES.indexOf(t.status);
  if (forward && required.length) {
    const failed = core.evaluateGates(root, cfg, t, core.treeHash(root), required).filter((g) => !g.ok);
    if (failed.length) return `gates не пройдені для ${to}:\n${failed.map(gateLine).join('\n')}`;
  }
  const tree = core.treeHash(root);
  if (t.status === 'REVIEWING' && to === 'IMPLEMENTING' && t.reviewTree === tree) {
    // Правки — лише після всіх обов'язкових звітів для зафіксованого хешу: блокери збираємо разом і виправляємо одним пакетом.
    const waiting = core.evaluateGates(root, cfg, t, tree, ['review', 'security']).filter((g) => g.pending);
    if (waiting.length) return `рев'ю ще не завершено для зафіксованого хешу ${tree.slice(0, 10)} — дочекайся всіх звітів:\n${waiting.map(gateLine).join('\n')}`;
  }
  // Хеш фіксується при вході в REVIEWING: звіти review/codex/security зараховуються лише для нього.
  if (to === 'REVIEWING') t.reviewTree = tree;
  if (to === 'IMPLEMENTING') delete t.reviewTree;
  core.pushHistory(t, { event: 'transition', from: t.status, to, agent: opt.agent, note: opt.note, ...(to === 'REVIEWING' ? { reviewTree: tree.slice(0, 10) } : {}) });
  t.status = to;
  if (opt.agent) t.agent = opt.agent;
  t.nextAction = deriveNext(t, cfg);
  return null;
}

/** Етап, на який resume переходить сам, якщо погодження користувача вже чинне. */
const AFTER_APPROVAL = { AWAITING_APPROVAL: 'IMPLEMENTING', AWAITING_FINAL_APPROVAL: 'READY_FOR_PR' };

/** Чи може orchestrator продовжувати без питань до користувача. */
function canContinue(t, cfg, tree) {
  if (t.status === 'BLOCKED') return { ok: false, why: 'задача BLOCKED' };
  if (t.status === 'AWAITING_APPROVAL') return { ok: false, why: `потрібне погодження користувача: APPROVE ${t.id}` };
  if (t.status === 'AWAITING_FINAL_APPROVAL') return { ok: false, why: `потрібне погодження користувача: APPROVE-FINAL ${t.id} (для поточного коду)` };
  if (['IMPLEMENTING', 'REVIEWING', 'QA', 'READY_FOR_PR'].includes(t.status)) {
    const a = core.approvalStatus(root, t);
    if (!a.ok) return { ok: false, why: a.detail };
    if (t.status === 'READY_FOR_PR' && !core.evaluateGate(root, cfg, t, tree, 'final').ok) return { ok: false, why: 'фінальний approval не для поточного коду' };
  }
  return { ok: true, why: 'погодження чинне, обсяг той самий' };
}

function metrics(t) {
  const h = t.history;
  const reworks = h.filter((e) => e.event === 'transition' && e.to === 'IMPLEMENTING' && e.from !== 'AWAITING_APPROVAL' && e.from !== 'PLANNING').length;
  const failedVerify = h.filter((e) => (e.event === 'verify' || e.event === 'tests') && e.ok === false).length;
  const blockingReviews = h.filter((e) => ['review', 'codex', 'security', 'qa'].includes(e.event) && e.blocking > 0).length;
  const started = h.find((e) => e.event === 'transition' && e.to === 'DISCOVERY')?.at;
  const pr = h.find((e) => e.event === 'pr')?.at;
  const hours = started && pr ? Math.round(((new Date(pr) - new Date(started)) / 36e5) * 10) / 10 : null;
  const usage = t.usage ?? {};
  const total = Object.values(usage).reduce((a, b) => a + b, 0);
  return { id: t.id, tier: core.effectiveTier(t), developerModel: t.model, tokensByRole: usage, tokensTotal: total, reworkCycles: reworks, failedVerify, repeatedFailures: t.repeats ?? 0, blockingReviews, hoursToPR: hours };
}

function report(state, id, cfg) {
  const t = core.getTask(state, id);
  const tree = core.treeHash(root);
  const gates = core.evaluateGates(root, cfg, t, tree, ['approval', 'verify', 'review', 'security', 'tests', 'qa', 'final']);
  const needsHuman = t.status === 'AWAITING_APPROVAL' || t.status === 'AWAITING_FINAL_APPROVAL' || t.status === 'BLOCKED';
  const lines = [
    `**${t.id} — ${t.title}**`,
    line(t, cfg),
    `QA-етап: ${core.qaRequired(t) ? (core.uiUnknown(t) ? 'потрібен (ui не оцінено — задача старої фабрики)' : 'потрібен (UI-задача)') : 'не потрібен'} · E2E: ${core.e2eRequired(root, t) ? 'потрібен' : 'не потрібен'} · Security: ${t.securityRequired ? 'потрібен' : 'не потрібен'}`,
    ...gates.map((g) => gateLine({ ...g, gate: GATE_TITLES[g.gate] })),
  ];
  if (t.issues.length) lines.push(`Проблеми: ${t.issues.join('; ')}`);
  if (t.blockers.length) lines.push(`Блокери: ${t.blockers.join('; ')}`);
  const next = deriveNext(t, cfg, tree);
  lines.push(`Наступна дія: ${next}`);
  if (t.nextAction && t.nextAction !== next) lines.push(`Нотатка (збережена, на рішення не впливає): ${t.nextAction}`);
  lines.push(`Потрібне твоє підтвердження: ${needsHuman ? 'так' : 'ні'}`);
  if (t.pr) lines.push(`PR: ${t.pr}`);
  lines.push(`Стан коду (tree): ${tree.slice(0, 10)}`);
  return lines.join('\n');
}

function runCommand(name, command) {
  if (!command) return { name, status: 'not_configured', exitCode: null, output: '' };
  const started = Date.now();
  const r = spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', env: { ...process.env, CI: '1' } });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.split('\n').slice(-40).join('\n');
  return { name, command, status: r.status === 0 ? 'passed' : 'failed', exitCode: r.status, durationMs: Date.now() - started, output };
}

const commands = {
  init() {
    if (fs.existsSync(core.paths(root).state)) return ok('state уже існує');
    core.saveState(root, core.loadState(root));
    ok('створено .factory/workflow-state.json');
  },

  add([id, ...title]) {
    const cfg = core.loadConfig(root);
    if (!id || !new RegExp(cfg.taskIdPattern).test(id)) fail(`ID має відповідати ${cfg.taskIdPattern}`);
    if (!title.length) fail('потрібна назва задачі');
    withState((s) => {
      if (s.tasks[id]) fail(`${id} уже існує`);
      s.tasks[id] = newTask(id, title.join(' '));
      core.pushHistory(s.tasks[id], { event: 'created' });
    });
    ok(`${id} додано в BACKLOG`);
  },

  start([id]) {
    withState((s) => {
      const t = core.getTask(s, id);
      if (t.status !== 'BACKLOG') fail(`${id} уже в статусі ${t.status}`);
      t.status = 'DISCOVERY'; t.agent = 'orchestrator';
      t.nextAction = deriveNext(t, core.loadConfig(root));
      core.pushHistory(t, { event: 'transition', from: 'BACKLOG', to: 'DISCOVERY' });
      s.currentTask = id;
    });
    ok(`${id} → DISCOVERY (поточна задача)`);
    console.log(line(core.getTask(core.loadState(root), id), core.loadConfig(root)));
  },

  classify([id, ...pairs]) {
    const scores = Object.fromEntries(pairs.map((p) => { const [k, v] = p.split('='); return [k, Number(v)]; }));
    const c = core.classify(scores);
    withState((s) => {
      const t = core.getTask(s, id);
      if (t.status !== 'PLANNING') fail(`класифікація можлива лише в PLANNING (зараз ${t.status})`);
      if (!fs.existsSync(core.planFile(root, id))) fail(`немає плану .factory/task-plans/${id}.md`);
      Object.assign(t, { scores, tier: c.tier, model: core.TIER_MODEL[c.tier], securityRequired: c.securityRequired });
      t.lastFailure = null;
      core.pushHistory(t, { event: 'classified', note: `сума ${c.sum} → ${c.tier}` });
      t.nextAction = deriveNext(t, core.loadConfig(root));
    });
    const cfg = core.loadConfig(root);
    const t = core.getTask(core.loadState(root), id);
    console.log(JSON.stringify({ id, ...c, developerModel: core.TIER_MODEL[c.tier], reviewModel: core.requiredReviewModel(cfg, t) }, null, 2));
    console.log(line(t, cfg));
  },

  transition([id, to], opt) {
    if (!core.STATUSES.includes(to)) fail(`невідомий статус ${to}`);
    const cfg = core.loadConfig(root);
    withState((s) => {
      const t = core.getTask(s, id);
      const err = applyTransition(t, to, cfg, opt);
      if (err) fail(err);
      s.currentTask = id;
    });
    ok(`${id} → ${to}`);
    console.log(line(core.getTask(core.loadState(root), id), cfg));
  },

  verify([id], opt) {
    const cfg = core.loadConfig(root);
    const kind = opt.full ? 'tests' : 'verify';
    const names = opt.full ? ['typecheck', 'lint', 'test', 'e2e'] : ['typecheck', 'lint', 'test'];
    const before = core.treeHash(root);
    if (!opt.force) {
      // Зелений результат для незмінного tree перевикористовується (повний прогін покриває і звичайний).
      const prev = core.readEvidence(root, id, before, kind) ?? (kind === 'verify' ? core.readEvidence(root, id, before, 'tests') : null);
      if (prev?.ok && !core.untracedCriteria(root, id, cfg).length) {
        console.log(`♻ ${kind}: зелений результат для цього стану коду вже є (${prev.kind}, ${prev.at}) — повторно використано; --force для перезапуску`);
        process.exit(0);
      }
    }
    const results = names.map((n) => { console.log(`… ${n}`); return runCommand(n, cfg.commands[n]); });
    const after = core.treeHash(root);
    const failed = results.filter((r) => r.status !== 'passed').map((r) => `${r.name}(${r.status})`);
    if (before !== after) failed.push('код змінився під час перевірки');
    const untraced = core.untracedCriteria(root, id, cfg);
    if (untraced.length) failed.push(`AC без тестів: ${untraced.join(', ')}`);
    const file = core.writeEvidence(root, id, before, kind, { ok: failed.length === 0, failed, results });
    const signature = failed.length
      ? core.failureSignature([...failed, ...results.filter((r) => r.status !== 'passed').map((r) => r.output.split('\n').slice(-10).join('\n'))])
      : null;
    let escalation = null;
    withState((s) => {
      const t = core.getTask(s, id);
      if (failed.length) {
        escalation = core.recordFailure(t, cfg, kind, signature);
        if (t.issues.at(-1) !== `${kind} failed: ${failed.join(', ')}`) t.issues.push(`${kind} failed: ${failed.join(', ')}`);
      } else if (t.lastFailure?.stage === kind) t.lastFailure = null;
      t.nextAction = deriveNext(t, cfg);
      core.pushHistory(t, { event: kind, ok: failed.length === 0, evidence: path.relative(root, file) });
    });
    results.forEach((r) => {
      console.log(`${r.status === 'passed' ? '✅' : '❌'} ${r.name}: ${r.status}${r.exitCode !== null && r.exitCode !== undefined ? ` (exit ${r.exitCode})` : ''}`);
      if (r.status === 'failed') {
        // Для передачі виконавцю: лише команда і конкретна діагностика.
        console.log(`   команда: ${r.command}`);
        r.output.split('\n').filter((l) => l.trim()).slice(-12).forEach((l) => console.log(`   │ ${l}`));
      }
    });
    if (untraced.length) console.log(`❌ AC без тестів: ${untraced.join(', ')} (developer додає тести з "${id} AC-n" у назві)`);
    if (escalation) console.log(escalation);
    console.log(`evidence: ${path.relative(root, file)}`);
    process.exit(failed.length ? 1 : 0);
  },

  record([id, kind, file]) {
    if (!['review', 'codex', 'security', 'qa'].includes(kind)) fail('kind: review | codex | security | qa');
    if (!file || !fs.existsSync(file)) fail('потрібен шлях до JSON-звіту');
    const cfg = core.loadConfig(root);
    const report = core.readJson(file);
    const errors = core.validateFindingsReport(report);
    if (errors.length) fail(`звіт невалідний:\n- ${errors.join('\n- ')}`);
    if (kind === 'codex' && report.agent !== 'codex') fail('звіт codex має мати agent: "codex"');
    const task = core.getTask(core.loadState(root), id);
    if (kind === 'review') {
      const need = core.requiredReviewModel(cfg, task);
      if (core.modelRank(report.model) < core.modelRank(need)) fail(`reviewer для tier ${core.effectiveTier(task)}${core.elevatedRisk(task) ? ' (підвищений ризик)' : ''} має працювати щонайменше на ${need} (отримано ${report.model})`);
    }
    if (kind === 'security' && cfg.pinnedStrongAgents.includes(report.agent) && report.model !== 'opus') fail(`${report.agent} має працювати на opus (отримано ${report.model})`);
    const tree = core.treeHash(root);
    if (kind !== 'qa') {
      if (task.status !== 'REVIEWING') fail(`звіт ${kind} записується лише в REVIEWING (зараз ${task.status})`);
      if (task.reviewTree && task.reviewTree !== tree) fail(`звіт ${kind} відхилено: код змінився після початку рев'ю (було ${task.reviewTree.slice(0, 10)}, зараз ${tree.slice(0, 10)}). Звіти рахуються лише для зафіксованого хешу — поверни задачу в IMPLEMENTING, перевір новий хеш (verify) і повтори рев'ю.`);
    }
    const ev = core.writeEvidence(root, id, tree, kind, report);
    const blocking = core.blockingFindings(report);
    let escalation = null;
    withState((s) => {
      const t = core.getTask(s, id);
      if (blocking.length) {
        t.issues.push(`${kind}: ${blocking.length} блокувальних findings`);
        if (kind !== 'qa') escalation = core.recordFailure(t, cfg, kind, core.failureSignature(blocking.map((f) => `${f.severity}:${f.title}:${f.file ?? ''}`)));
      }
      t.nextAction = deriveNext(t, cfg);
      core.pushHistory(t, { event: kind, model: report.model, findings: report.findings.length, blocking: blocking.length, evidence: path.relative(root, ev) });
    });
    console.log(`${blocking.length ? '❌' : '✅'} ${kind}: ${report.findings.length} findings, блокувальних ${blocking.length}`);
    if (escalation) console.log(escalation);
    process.exit(blocking.length ? 1 : 0);
  },

  retitle([id, ...title]) {
    if (!title.length) fail('потрібна нова назва');
    withState((s) => {
      const t = core.getTask(s, id);
      core.pushHistory(t, { event: 'retitled', note: `${t.title} → ${title.join(' ')}` });
      t.title = title.join(' ');
    });
    ok(`${id} перейменовано`);
  },

  remove([id]) {
    withState((s) => {
      const t = core.getTask(s, id);
      if (t.status !== 'BACKLOG') fail(`видаляти можна лише задачі в BACKLOG (${id}: ${t.status})`);
      delete s.tasks[id];
      if (s.currentTask === id) s.currentTask = null;
    });
    ok(`${id} видалено з бектлогу`);
  },

  escalate([id, ...reason]) {
    if (!reason.length) fail('потрібна причина: який складний дефект лишився після цільового виправлення');
    const msg = withState((s) => {
      const t = core.getTask(s, id);
      if (!['IMPLEMENTING', 'REVIEWING', 'QA'].includes(t.status)) fail(`escalate лише під час доопрацювання (зараз ${t.status})`);
      return core.escalateModel(t, reason.join(' '));
    });
    ok(msg);
  },

  resume([id]) {
    const cfg = core.loadConfig(root);
    const taskId = id ?? core.loadState(root).currentTask;
    if (!taskId) fail('немає поточної задачі');
    const tree = core.treeHash(root);
    const notes = [];
    withState((s) => {
      const t = core.getTask(s, taskId);
      const tier = core.effectiveTier(t);
      const model = core.effectiveModel(t);
      // Стара автоескалація: tier/модель повертаються до оцінки складності, ручні підвищення лишаються.
      if (tier && (t.tier !== tier || (t.model && model && t.model !== model))) {
        notes.push(`відновлено за балами: tier ${t.tier} → ${tier}, модель ${t.model ?? '—'} → ${model}`);
        core.pushHistory(t, { event: 'restored', note: notes.at(-1) });
        t.tier = tier; t.model = model;
      }
      // Погодження вже чинне (APPROVE для плану / APPROVE-FINAL для поточного tree) → наступний дозволений етап без повторного запиту.
      const to = AFTER_APPROVAL[t.status];
      if (to) {
        const from = t.status;
        if (!applyTransition(t, to, cfg, { note: 'resume: погодження вже чинне' })) notes.push(`погодження вже чинне: ${from} → ${to}`);
      }
      t.nextAction = deriveNext(t, cfg, tree);
      s.currentTask = taskId;
    });
    const t = core.getTask(core.loadState(root), taskId);
    notes.forEach((n) => console.log(`↺ ${n}`));
    console.log(line(t, cfg));
    const gates = core.evaluateGates(root, cfg, t, tree, ALL_GATES);
    console.log(gates.map((g) => `${g.ok ? '✅' : g.pending ? '⏳' : '❌'}${g.gate}`).join(' '));
    const c = canContinue(t, cfg, tree);
    console.log(`Продовжувати без питань: ${c.ok ? 'так' : 'ні'} — ${c.why}`);
  },

  line([id]) {
    const s = core.loadState(root);
    const taskId = id ?? s.currentTask;
    if (!taskId) fail('немає поточної задачі');
    console.log(line(core.getTask(s, taskId), core.loadConfig(root)));
  },

  usage([id, role, tokens]) {
    const n = Number(tokens);
    if (!role || !Number.isInteger(n) || n < 0) fail('використання: usage <ID> <role> <tokens>');
    withState((s) => {
      const t = core.getTask(s, id);
      t.usage = t.usage ?? {};
      t.usage[role] = (t.usage[role] ?? 0) + n;
    });
    ok(`${id}: ${role} +${n} токенів`);
  },

  metrics([id]) {
    const s = core.loadState(root);
    const ids = id ? [id] : Object.values(s.tasks).filter((t) => t.status === 'COMPLETED' || t.usage).map((t) => t.id);
    console.log(JSON.stringify(ids.map((i) => metrics(core.getTask(s, i))), null, 2));
  },

  issue([id, ...text]) { withState((s) => { core.getTask(s, id).issues.push(text.join(' ')); }); ok('записано'); },
  next([id, ...text]) { withState((s) => { core.getTask(s, id).nextAction = text.join(' '); }); ok('записано'); },
  pr([id, url]) { withState((s) => { const t = core.getTask(s, id); t.pr = url; core.pushHistory(t, { event: 'pr', note: url }); }); ok('PR записано'); },

  block([id, ...reason]) {
    withState((s) => {
      const t = core.getTask(s, id);
      t.blockedFrom = t.status; t.status = 'BLOCKED'; t.blockers.push(reason.join(' '));
      core.pushHistory(t, { event: 'blocked', note: reason.join(' ') });
    });
    ok(`${id} → BLOCKED`);
  },

  unblock([id]) {
    withState((s) => {
      const t = core.getTask(s, id);
      if (t.status !== 'BLOCKED') fail('задача не BLOCKED');
      t.status = t.blockedFrom ?? 'PLANNING'; t.blockers = [];
      core.pushHistory(t, { event: 'unblocked', to: t.status });
    });
    ok(`${id} розблоковано`);
  },

  gates([id], opt) {
    const cfg = core.loadConfig(root);
    const state = core.loadState(root);
    const stage = opt.stage ?? 'worktree';
    if (stage === 'pre-commit' || stage === 'pre-push') {
      const changed = stage === 'pre-commit'
        ? core.git(root, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean)
        : pushedFiles();
      const code = changed.filter((f) => core.matchesAny(f, cfg.codeGlobs));
      if (!code.length) { ok(`${stage}: зміни не зачіпають код застосунку — gates не потрібні`); return; }
    }
    const taskId = id ?? state.currentTask;
    if (!taskId) fail('немає поточної задачі: зміни коду мають іти через задачу (/factory)');
    const t = core.getTask(state, taskId);
    const tree = core.treeHash(root, stage === 'pre-commit' ? 'index' : stage === 'pre-push' ? 'HEAD' : 'worktree');
    const list = stage === 'pre-commit' ? core.REQUIRED_GATES.AWAITING_FINAL_APPROVAL : core.REQUIRED_GATES.READY_FOR_PR;
    const res = core.evaluateGates(root, cfg, t, tree, list);
    console.log(`${taskId} · ${stage} · tree ${tree.slice(0, 10)}`);
    res.forEach((g) => console.log(gateLine(g)));
    if (res.some((g) => !g.ok)) fail(`${stage}: gates не пройдені`);
    ok(`${stage}: усі gates пройдені`);
  },

  status([id]) {
    const s = core.loadState(root);
    if (id) return console.log(JSON.stringify(core.getTask(s, id), null, 2));
    console.log(`Поточна задача: ${s.currentTask ?? '—'}`);
    Object.values(s.tasks).forEach((t) => console.log(`${t.id}  ${t.status.padEnd(24)} ${(core.effectiveTier(t) ?? '-').padEnd(9)} ${t.title}`));
  },

  report([id]) {
    const s = core.loadState(root);
    const taskId = id ?? s.currentTask;
    if (!taskId) fail('немає поточної задачі');
    console.log(report(s, taskId, core.loadConfig(root)));
  },

  tree(_, opt) { console.log(core.treeHash(root, opt.stage ?? 'worktree')); },

  selftest() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const r = spawnSync(process.execPath, [path.join(here, 'selftest.mjs')], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  },
};

function pushedFiles() {
  const { integration, production } = core.loadConfig(root).branches;
  for (const b of [integration, production]) {
    try {
      const base = core.git(root, ['rev-parse', '--verify', '-q', `origin/${b}`]).trim();
      return core.git(root, ['diff', '--name-only', `${base}...HEAD`]).split('\n').filter(Boolean);
    } catch { /* спробувати наступну базу */ }
  }
  return core.git(root, ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean);
}

if (!cmd || cmd === 'help' || !commands[cmd]) { console.log(HELP); process.exit(cmd && cmd !== 'help' ? 1 : 0); }
const { pos, opt } = flags(rest);
try {
  commands[cmd](pos, opt);
} catch (e) {
  fail(e.message);
}
