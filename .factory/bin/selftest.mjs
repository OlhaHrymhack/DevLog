#!/usr/bin/env node
// Автоматичні сценарії перевірки фабрики. Працює в тимчасовому git-репо — реальний стан не чіпає.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const realRoot = path.resolve(here, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-selftest-'));
const reports = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-reports-'));
const env = { ...process.env, FACTORY_ROOT: tmp, CLAUDE_PROJECT_DIR: tmp };
let passed = 0; const failures = [];

// ---------- підготовка ----------
fs.cpSync(path.join(realRoot, '.factory', 'bin'), path.join(tmp, '.factory', 'bin'), { recursive: true });
fs.cpSync(path.join(realRoot, '.claude', 'hooks'), path.join(tmp, '.claude', 'hooks'), { recursive: true });
const cfg = JSON.parse(fs.readFileSync(path.join(realRoot, '.factory', 'project.config.json'), 'utf8'));
cfg.commands = { typecheck: 'node -e "0"', lint: 'node -e "0"', test: 'node check.mjs', e2e: 'node -e "0"' };
fs.writeFileSync(path.join(tmp, '.factory', 'project.config.json'), JSON.stringify(cfg, null, 2));
for (const d of ['task-plans', 'evidence', 'approvals']) fs.mkdirSync(path.join(tmp, '.factory', d), { recursive: true });
fs.mkdirSync(path.join(tmp, 'src'));
fs.mkdirSync(path.join(tmp, 'docs', 'vault'), { recursive: true });
const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), text); };
w('src/app.ts', 'export const a = 1;\n');
w('check.mjs', 'import fs from "node:fs"; process.exit(fs.existsSync("FAIL") ? 1 : 0);\n');
w('.gitignore', '.claude/prompt-log.md\n');
w('README.md', '# App\n\n## Запуск\n\nnpm run dev\n\n## Рішення і компроміси\n\nПише автор.\n');
w('docs/vault/decisions.md', '# Decisions\n\n- D1: SQLite\n');
execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: tmp });

// ---------- helpers ----------
const factory = (...args) => spawnSync(process.execPath, [path.join(tmp, '.factory/bin/factory.mjs'), ...args], { cwd: tmp, env, encoding: 'utf8' });
const hook = (name, input, extraArgs = []) => {
  const r = spawnSync(process.execPath, [path.join(tmp, '.claude/hooks', name), ...extraArgs], { cwd: tmp, env, encoding: 'utf8', input: JSON.stringify(input) });
  let out = null; try { out = JSON.parse(r.stdout); } catch { /* plain text */ }
  return { ...r, json: out, decision: out?.hookSpecificOutput?.permissionDecision ?? out?.decision ?? 'allow' };
};
const guard = (tool_name, tool_input) => hook('pre-tool-guard.mjs', { hook_event_name: 'PreToolUse', tool_name, tool_input }).decision;
const user = (prompt) => hook('user-prompt.mjs', { hook_event_name: 'UserPromptSubmit', prompt });
const state = () => JSON.parse(fs.readFileSync(path.join(tmp, '.factory/workflow-state.json'), 'utf8'));
const findings = (name, agent, model, list) => { const f = path.join(reports, `${name}.json`); fs.writeFileSync(f, JSON.stringify({ agent, model, summary: 'test', findings: list })); return f; };
const PLAN = '# DEV-001\n\n## Acceptance criteria\n- AC-1: створення задачі\n';

function check(scenario, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${scenario}`); } else { failures.push(scenario); console.log(`  ❌ ${scenario} ${detail}`); }
}
const allScores = (v, over = {}) => ['modules', 'architecture', 'criticality', 'security', 'integrations', 'migrations', 'state', 'uncertainty'].map((k) => `${k}=${over[k] ?? v}`);

// ---------- сценарії ----------
console.log('\n[1–2] Маршрутизація моделей');
factory('add', 'DEV-090', 'Проста задача'); factory('start', 'DEV-090'); factory('transition', 'DEV-090', 'PLANNING');
w('.factory/task-plans/DEV-090.md', '# plan\n');
let r = factory('classify', 'DEV-090', ...allScores(0, { modules: 1 }));
check('1. проста задача → fast / haiku', /"tier": "fast"/.test(r.stdout) && /"developerModel": "haiku"/.test(r.stdout), r.stdout + r.stderr);
factory('add', 'DEV-091', 'Складна задача'); factory('start', 'DEV-091'); factory('transition', 'DEV-091', 'PLANNING');
w('.factory/task-plans/DEV-091.md', '# plan\n');
r = factory('classify', 'DEV-091', ...allScores(0, { security: 2 }));
check('2. високий ризик навіть при малій сумі → strong / opus', /"tier": "strong"/.test(r.stdout) && /"developerModel": "opus"/.test(r.stdout), r.stdout);
r = factory('classify', 'DEV-091', ...allScores(2));
check('2b. велика сума балів → strong', /"tier": "strong"/.test(r.stdout));

console.log('\n[3] Approval gate');
factory('add', 'DEV-001', 'CRUD задач'); factory('start', 'DEV-001'); factory('transition', 'DEV-001', 'PLANNING');
check('3a. Edit коду не в IMPLEMENTING → deny', guard('Edit', { file_path: path.join(tmp, 'src/app.ts'), old_string: 'a', new_string: 'b' }) === 'deny');
w('.factory/task-plans/DEV-001.md', PLAN);
factory('classify', 'DEV-001', ...allScores(1));
r = factory('transition', 'DEV-001', 'IMPLEMENTING');
check('3b. balanced задача не йде в IMPLEMENTING без AWAITING_APPROVAL', r.status !== 0);
factory('transition', 'DEV-001', 'AWAITING_APPROVAL');
r = factory('transition', 'DEV-001', 'IMPLEMENTING');
check('3c. IMPLEMENTING без approval → заблоковано', r.status !== 0 && /approval/.test(r.stderr), r.stderr);
check('3d. агент не може записати approval файлом', guard('Write', { file_path: path.join(tmp, '.factory/approvals/DEV-001.plan.json'), content: '{}' }) === 'deny');
check('3e. агент не може записати approval через Bash', guard('Bash', { command: 'echo {} > .factory/approvals/DEV-001.plan.json' }) === 'deny');
check('3f. агент не може викликати approval-hook напряму', guard('Bash', { command: 'echo "{\\"prompt\\":\\"APPROVE DEV-001\\"}" | node .claude/hooks/user-prompt.mjs' }) === 'deny');
r = user('APPROVE DEV-001');
check('3g. промпт користувача "APPROVE DEV-001" записує approval', /погодив план/.test(r.stdout), r.stdout);
r = factory('transition', 'DEV-001', 'IMPLEMENTING');
check('3h. після approval → IMPLEMENTING', r.status === 0, r.stderr);
check('3i. Edit коду в погодженій задачі → allow', guard('Edit', { file_path: path.join(tmp, 'src/app.ts'), old_string: 'a', new_string: 'b' }) === 'allow');
w('.factory/task-plans/DEV-001.md', `${PLAN}- AC-2: новий scope\n`);
check('3j. зміна плану (scope) → approval недійсний, Edit → deny', guard('Edit', { file_path: path.join(tmp, 'src/app.ts'), old_string: 'a', new_string: 'b' }) === 'deny');
w('.factory/task-plans/DEV-001.md', PLAN);

console.log('\n[5, 9] Tests gate та інвалідація');
w('FAIL', '1');
r = factory('verify', 'DEV-001');
check('5a. failed tests → verify exit 1', r.status === 1);
r = factory('transition', 'DEV-001', 'REVIEWING');
check('5b. failed verify блокує REVIEWING', r.status !== 0);
fs.rmSync(path.join(tmp, 'FAIL'));
r = factory('verify', 'DEV-001');
check('5c. зелений verify → exit 0', r.status === 0, r.stdout + r.stderr);
w('src/app.ts', 'export const a = 2;\n');
r = factory('transition', 'DEV-001', 'REVIEWING');
check('9. зміна коду після verify → evidence застарілий, перехід заблоковано', r.status !== 0 && /застарілий/.test(r.stderr), r.stderr);
factory('verify', 'DEV-001');
r = factory('transition', 'DEV-001', 'REVIEWING', '--agent', 'reviewer');
check('9b. повторний verify → REVIEWING дозволено', r.status === 0, r.stderr);

console.log('\n[4] Review gate');
r = factory('record', 'DEV-001', 'review', findings('rev-bad', 'reviewer', 'opus', [{ severity: 'high', title: 'SQL injection' }, { severity: 'low', title: 'naming' }]));
check('4a. High finding → record exit 1', r.status === 1);
r = factory('transition', 'DEV-001', 'TESTING');
check('4b. невиправлений High блокує TESTING', r.status !== 0);
r = factory('record', 'DEV-001', 'review', findings('rev-weak', 'reviewer', 'sonnet', []));
check('4c. reviewer не на opus → звіт відхилено', r.status !== 0 && /opus/.test(r.stderr));
check('4d. виклик reviewer з model=haiku → deny', guard('Agent', { subagent_type: 'reviewer', model: 'haiku', prompt: 'x' }) === 'deny');
check('4e. виклик reviewer без override → allow', guard('Agent', { subagent_type: 'reviewer', prompt: 'x' }) === 'allow');
factory('record', 'DEV-001', 'review', findings('rev-ok', 'reviewer', 'opus', [{ severity: 'low', title: 'naming' }]));

console.log('\n[6] Security gate');
r = factory('record', 'DEV-001', 'security', findings('sec-bad', 'security', 'opus', [{ severity: 'critical', title: 'key leak' }]));
r = factory('transition', 'DEV-001', 'TESTING');
check('6. Critical security finding блокує TESTING (задача з security-ризиком)', r.status !== 0 && /security/.test(r.stderr), r.stderr);
factory('record', 'DEV-001', 'security', findings('sec-ok', 'security', 'opus', []));
check('6c. 2 провали (verify + review) → ескалація balanced → strong', state().tasks['DEV-001'].tier === 'strong' && state().tasks['DEV-001'].model === 'opus');
factory('record', 'DEV-001', 'codex', findings('cx-1', 'codex', 'gpt', []));
r = factory('transition', 'DEV-001', 'TESTING');
check('6b. після виправлення → TESTING', r.status === 0, r.stderr);

console.log('\n[7] Успішний PR-флоу (локальна частина)');
factory('verify', 'DEV-001', '--full');
r = factory('transition', 'DEV-001', 'QA');
check('7a. AC без тесту блокує QA (traceability)', r.status !== 0 && /AC-1/.test(r.stderr), r.stderr);
w('src/app.test.ts', 'test("DEV-001 AC-1: створення задачі", () => {});\n');
factory('verify', 'DEV-001'); factory('record', 'DEV-001', 'review', findings('rev-ok2', 'reviewer', 'opus', []));
factory('record', 'DEV-001', 'security', findings('sec-ok2', 'security', 'opus', []));
factory('record', 'DEV-001', 'codex', findings('cx-2', 'codex', 'gpt', []));
factory('verify', 'DEV-001', '--full');
r = factory('transition', 'DEV-001', 'QA', '--agent', 'qa');
check('7b. з тестом на AC-1 → QA', r.status === 0, r.stderr);
factory('record', 'DEV-001', 'qa', findings('qa-ok', 'qa', 'sonnet', []));
factory('transition', 'DEV-001', 'AWAITING_FINAL_APPROVAL');
r = factory('transition', 'DEV-001', 'READY_FOR_PR');
check('7c. READY_FOR_PR без фінального approval → заблоковано', r.status !== 0);
user('APPROVE-FINAL DEV-001');
r = factory('transition', 'DEV-001', 'READY_FOR_PR');
check('7d. після APPROVE-FINAL → READY_FOR_PR', r.status === 0, r.stderr);
execFileSync('git', ['add', '-A'], { cwd: tmp });
r = factory('gates', '--stage', 'pre-commit');
check('7e. pre-commit gates пройдені для staged коду', r.status === 0, r.stdout + r.stderr);
r = factory('transition', 'DEV-001', 'COMPLETED');
check('7f. COMPLETED без PR reference → заблоковано', r.status !== 0);
factory('pr', 'DEV-001', 'https://github.com/x/y/pull/1');
r = factory('transition', 'DEV-001', 'COMPLETED');
check('7g. з PR reference → COMPLETED', r.status === 0, r.stderr);
check('7h. guard: gh pr merge → deny', guard('Bash', { command: 'gh pr merge 1 --squash' }) === 'deny');

console.log('\n[7+] Fast-задача: без approval і без QA');
r = factory('transition', 'DEV-090', 'IMPLEMENTING');
check('7i. fast → IMPLEMENTING без approval', r.status === 0, r.stderr);
factory('verify', 'DEV-090'); factory('transition', 'DEV-090', 'REVIEWING');
factory('record', 'DEV-090', 'review', findings('rev-fast', 'reviewer', 'opus', []));
factory('transition', 'DEV-090', 'TESTING'); factory('verify', 'DEV-090', '--full');
r = factory('transition', 'DEV-090', 'AWAITING_FINAL_APPROVAL');
check('7j. fast: TESTING → AWAITING_FINAL_APPROVAL (QA пропущено)', r.status === 0, r.stderr);
r = factory('transition', 'DEV-091', 'AWAITING_FINAL_APPROVAL');
check('7k. не-fast не може пропустити QA', r.status !== 0);
check('7l. push у stage → deny', guard('Bash', { command: 'git push origin stage' }) === 'deny');
check('7m. push без refspec з main → deny; фіча-гілка → allow', guard('Bash', { command: 'git push' }) === 'deny' && guard('Bash', { command: 'git push -u origin feat/DEV-001-init' }) === 'allow');

console.log('\n[4+] Strong-задача: друге рев\'ю іншою модельною сім\'єю (codex)');
factory('add', 'DEV-092', 'Strong'); factory('start', 'DEV-092'); factory('transition', 'DEV-092', 'PLANNING');
w('.factory/task-plans/DEV-092.md', '# plan\n');
factory('classify', 'DEV-092', ...allScores(0, { security: 2 }));
factory('transition', 'DEV-092', 'AWAITING_APPROVAL'); user('APPROVE DEV-092');
factory('transition', 'DEV-092', 'IMPLEMENTING'); factory('verify', 'DEV-092');
factory('transition', 'DEV-092', 'REVIEWING');
factory('record', 'DEV-092', 'review', findings('rev-s', 'reviewer', 'opus', []));
factory('record', 'DEV-092', 'security', findings('sec-s', 'security', 'opus', []));
r = factory('transition', 'DEV-092', 'TESTING');
check('4f. strong без codex-рев\'ю → TESTING заблоковано', r.status !== 0 && /codex/.test(r.stderr), r.stderr);
factory('record', 'DEV-092', 'codex', findings('cx-bad', 'codex', 'gpt', [{ severity: 'high', title: 'race' }]));
r = factory('transition', 'DEV-092', 'TESTING');
check('4g. High від codex блокує', r.status !== 0);
factory('record', 'DEV-092', 'codex', findings('cx-ok', 'codex', 'gpt', []));
r = factory('transition', 'DEV-092', 'TESTING');
check('4h. reviewer + codex без блокерів → TESTING', r.status === 0, r.stderr);

console.log('\n[8] Відновлення зі стану');
const s = state();
check('8a. стан збережено на диску між процесами', s.tasks['DEV-001'].status === 'COMPLETED' && s.tasks['DEV-001'].history.length > 10);
factory('add', 'DEV-002', 'Перервана задача'); factory('start', 'DEV-002');
r = spawnSync(process.execPath, [path.join(tmp, '.claude/hooks/session-start.mjs')], { cwd: tmp, env, encoding: 'utf8' });
check('8b. SessionStart показує незавершену задачу', /DEV-002/.test(r.stdout) && /DISCOVERY/.test(r.stdout), r.stdout);

console.log('\n[10] Секрети');
check('10a. Read .env → deny', guard('Read', { file_path: path.join(tmp, '.env') }) === 'deny');
check('10b. Read .env.local / .env.production → deny', guard('Read', { file_path: '.env.local' }) === 'deny' && guard('Read', { file_path: 'apps/web/.env.production' }) === 'deny');
check('10c. Read .env.example → allow', guard('Read', { file_path: path.join(tmp, '.env.example') }) === 'allow');
check('10d. Bash cat .env → deny', guard('Bash', { command: 'cat .env' }) === 'deny');
check('10e. Bash cat .env.example → allow', guard('Bash', { command: 'cat .env.example' }) === 'allow');
check('10f. Bash printenv / echo $ANTHROPIC_API_KEY → deny', guard('Bash', { command: 'printenv' }) === 'deny' && guard('Bash', { command: 'echo $ANTHROPIC_API_KEY' }) === 'deny');
check('10g. Grep по .env / рекурсивний grep → deny', guard('Grep', { pattern: 'KEY', path: '.env' }) === 'deny' && guard('Bash', { command: 'grep -rn KEY .' }) === 'deny');
check('10h. Read приватного ключа → deny', guard('Read', { file_path: '/Users/x/.ssh/id_rsa' }) === 'deny');
r = user('мій ключ sk-ant-api03-abcdefghijklmnop');
check('10i. секрет у промпті маскується в prompt-log', !fs.readFileSync(path.join(tmp, '.claude/prompt-log.md'), 'utf8').includes('abcdefghijklmnop'));

console.log('\n[+] Гілки і PR');
check('коміт прямо в main → deny', guard('Bash', { command: 'git commit -m "x"' }) === 'deny');
execFileSync('git', ['checkout', '-q', '-b', 'feat/DEV-001-test'], { cwd: tmp });
check('коміт у фіча-гілці → allow', guard('Bash', { command: 'git commit -m "DEV-001: x"' }) === 'allow');
check('gh pr create без --base / з --base main → deny', guard('Bash', { command: 'gh pr create --title x --body y' }) === 'deny' && guard('Bash', { command: 'gh pr create --base main --title x' }) === 'deny');
check('gh pr create --base stage → allow', guard('Bash', { command: 'gh pr create --base stage --title "DEV-001: x" --body-file /tmp/b.md' }) === 'allow');

console.log('\n[+] Деструктивні команди та документи');
check('force push → deny', guard('Bash', { command: 'git push --force origin feat' }) === 'deny');
check('push у main → deny', guard('Bash', { command: 'git push origin main' }) === 'deny');
check('commit --no-verify / -n → deny', guard('Bash', { command: 'git commit --no-verify -m x' }) === 'deny' && guard('Bash', { command: 'git commit -nm "x"' }) === 'deny');
check('commit -m з "-n" у тексті → allow', guard('Bash', { command: 'git commit -m "fix -n flag"' }) === 'allow');
check('rm -rf src → deny; rm -rf node_modules → allow', guard('Bash', { command: 'rm -rf src' }) === 'deny' && guard('Bash', { command: 'rm -rf node_modules .next' }) === 'allow');
check('git reset --hard → deny', guard('Bash', { command: 'git reset --hard HEAD~1' }) === 'deny');
check('AGENT_LOG.md пише лише автор → deny', guard('Write', { file_path: path.join(tmp, 'AGENT_LOG.md'), content: 'x' }) === 'deny');
check('README: правка розділу «Рішення і компроміси» → deny', guard('Edit', { file_path: path.join(tmp, 'README.md'), old_string: 'Пише автор.', new_string: 'Пише AI.' }) === 'deny');
check('README: правка іншого розділу → allow', guard('Edit', { file_path: path.join(tmp, 'README.md'), old_string: 'npm run dev', new_string: 'npm install && npm run dev' }) === 'allow');
check('decisions.md: дописування в кінець → allow', guard('Edit', { file_path: path.join(tmp, 'docs/vault/decisions.md'), old_string: '- D1: SQLite\n', new_string: '- D1: SQLite\n- D2: Drizzle\n' }) === 'allow');
check('decisions.md: переписування історії → deny', guard('Edit', { file_path: path.join(tmp, 'docs/vault/decisions.md'), old_string: 'D1: SQLite', new_string: 'D1: Postgres' }) === 'deny');
check('зміна hooks фабрики → ask (потрібне підтвердження)', guard('Edit', { file_path: path.join(tmp, '.claude/hooks/stop.mjs'), old_string: 'a', new_string: 'b' }) === 'ask');
const pg = hook('path-guard.mjs', { tool_name: 'Write', tool_input: { file_path: path.join(tmp, 'src/app.ts'), content: 'x' } }, ['qa']);
const pgOk = hook('path-guard.mjs', { tool_name: 'Write', tool_input: { file_path: path.join(tmp, 'src/app.test.ts'), content: 'x' } }, ['qa']);
check('QA-агент не може змінювати прод-код, може — тести', pg.decision === 'deny' && pgOk.decision === 'allow');

// ---------- підсумок ----------
fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(reports, { recursive: true, force: true });
console.log(`\nРезультат: ${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(`Провалені: ${failures.join(' | ')}`); process.exit(1); }
