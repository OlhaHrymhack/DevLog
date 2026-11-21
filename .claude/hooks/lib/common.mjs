// Спільні утиліти для hooks Claude Code.
import fs from 'node:fs';

export function readInput() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

/**
 * Журнал спрацювань контролю (.factory/guard-log.jsonl): блокування guard-ом, запити підтвердження,
 * відмови в дозволах. Сировина для AGENT_LOG і ретро. Вміст маскується і обрізається.
 */
export function logControlEvent(root, event) {
  try {
    const line = JSON.stringify({ at: new Date().toISOString(), ...event }, (k, v) => (typeof v === 'string' ? maskSecrets(v).slice(0, 300) : v));
    fs.mkdirSync(`${root}/.factory`, { recursive: true });
    fs.appendFileSync(`${root}/.factory/guard-log.jsonl`, `${line}\n`);
  } catch { /* журнал не повинен ламати guard */ }
}

/** PreToolUse: заборонити виклик з поясненням (бачить і модель, і користувач). */
export function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `[factory] ${reason}` },
  }));
  process.exit(0);
}

/** PreToolUse: попросити підтвердження користувача. */
export function ask(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `[factory] ${reason}` },
  }));
  process.exit(0);
}

/** Мінімальний shell-токенайзер: враховує лапки та оператори ; | & < >. */
export function tokenize(cmd) {
  const tokens = []; let cur = ''; let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) { if (c === quote) quote = null; else cur += c; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (/\s/.test(c) || ';|&<>()'.includes(c)) { if (cur) tokens.push(cur); cur = ''; if (!/\s/.test(c)) tokens.push(c); continue; }
    cur += c;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

/** Ділить команду на підкоманди за ; && || | */
export function subcommands(cmd) {
  const out = []; let cur = [];
  for (const t of tokenize(cmd)) {
    if ([';', '|', '&'].includes(t)) { if (cur.length) out.push(cur); cur = []; } else cur.push(t);
  }
  if (cur.length) out.push(cur);
  return out;
}

export function maskSecrets(text) {
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, 'sk-ant-***')
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, 'sk-***')
    .replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, 'gh*_***')
    .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA***')
    .replace(/((?:api[_-]?key|token|secret|password)\s*[=:]\s*)\S+/gi, '$1***');
}
