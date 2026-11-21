---
tags: [architecture, factory]
---
# AI Development Factory

Універсальний процес розробки на Claude Code для TS / React / Next.js / Node проєктів. Проєктне — лише `.factory/project.config.json`, `CLAUDE.md` і `docs/vault/`.

## Конвеєр
```
BACKLOG → DISCOVERY → PLANNING → AWAITING_APPROVAL → IMPLEMENTING → REVIEWING
  → TESTING → QA → AWAITING_FINAL_APPROVAL → READY_FOR_PR → COMPLETED      (будь-де → BLOCKED)
```
| Етап | Агент | Модель | Вихід | Gate для виходу |
|---|---|---|---|---|
| Discovery | researcher | haiku | контекст, питання | немає відкритих питань |
| Planning | architect | opus | `task-plans/<ID>.md`, CLASSIFY | план за шаблоном, AC-n |
| Approval | **користувач** | — | `APPROVE <ID>` | Gate 1 (fast — без approval) |
| Implementation | developer | за tier | код + unit-тести | Gate 2: `factory verify` |
| Review | reviewer (+ codex для strong) | opus (pinned) / OpenAI | JSON findings | Gate 3: без Critical/High в обох |
| Security | security | opus (pinned) | JSON findings | Gate 4 (якщо security/integrations ≥ 1) |
| Testing | qa | sonnet | тести на кожен AC | Gate 5: `verify --full` + AC traceability |
| QA | qa | sonnet | браузерна перевірка | без Critical/High (fast — пропускається, D-005) |
| Final approval | **користувач** | — | `APPROVE-FINAL <ID>` | Gate 6, прив'язаний до tree hash |
| PR | orchestrator | — | гілка, коміт, PR (без merge) | pre-commit / pre-push / CI |
| Docs / Retro | docs | haiku | vault | — |

## Маршрутизація моделей
8 критеріїв × 0–2 бали (architect). 0–3 fast/haiku · 4–8 balanced/sonnet · ≥ 9 strong/opus; security = 2 або integrations = 2 → завжди strong. Ескалація (CLI): 2 провали verify/review на рівні → наступний рівень; 3 провали на strong → BLOCKED і питання користувачу. Кількість спроб на рівні зберігається в стані — основа для оцінки вартості.

## Механізми контролю
| Що | Де | Тип |
|---|---|---|
| Секрети (.env*, ключі, credentials; дозволено `.env.example`) | `permissions.deny` + `pre-tool-guard.mjs` (Read/Edit/Write/Grep/Glob/Bash) | блок |
| Деструктивні команди, force push, push у main, merge, `--no-verify`, `reset --hard` | `pre-tool-guard.mjs` + deny | блок |
| Код лише в IMPLEMENTING з чинним approval; зміна плану анулює approval | `pre-tool-guard.mjs` (workflow gate) | блок |
| State / evidence / approvals — лише CLI; approval — лише промпт людини | guard + `user-prompt.mjs` | блок |
| Зміна hooks / CLI / settings | guard | запит підтвердження |
| reviewer / security не нижче opus | guard на `Agent` + перевірка у `factory record` | блок |
| Права ролей (architect → плани, qa → тести, docs → vault) | `path-guard.mjs` у frontmatter агентів | блок |
| `AGENT_LOG.md`, README «Рішення і компроміси» — лише автор | guard | блок |
| `decisions.md` append-only | guard | блок |
| Незверифіковані зміни в кінці ходу | `stop.mjs` | нагадування (1 раз) |
| Відновлення після перерви | `session-start.mjs` | контекст |
| Коміт коду лише з зеленими gates для staged tree; push — з фінальним approval | `.githooks/pre-commit`, `pre-push` | блок |
| Незалежна перевірка поза машиною розробника | `.github/workflows/ci.yml` | блок PR |

## gstack (глобально, `~/.claude/skills/gstack`, v1.102.1 stable)
Встановлено лише skills зі специфікації (D-007): `/office-hours`, `/plan-ceo-review` (Discovery — лише за запитом користувача, бізнес-вимоги не вигадуємо) · `/plan-eng-review`, `/plan-design-review` (architect) · `/review` (reviewer, без авто-фіксів) · `/codex` (друге рев'ю для strong, D-008) · `/cso` (security; Docker є → повний режим) · `/qa`, `/qa-only`, `/design-review`, `/test-audit` (qa) · `/verify` (developer) · `/ship` (PR у stage, без merge) · `/careful`, `/guard` (+`freeze`/`unfreeze`) · `/retro`, `/learn` (docs). `/test` у gstack не існує.

## Гілки (D-006)
`feat/<ID>-<slug>` → PR у `stage` → (користувач) merge → `stage` → (користувач) merge → `main` (prod). Push у `stage`/`main` і `gh pr merge` заблоковано.

## Як користуватися
- `/factory DEV-001` — провести задачу; `/factory status`; `/factory new <опис>`.
- Погодити план: написати `APPROVE DEV-001`. Перед PR: `APPROVE-FINAL DEV-001`.
- `node .factory/bin/factory.mjs report` — звіт; `... selftest` — перевірка самої фабрики.

## Чесні обмеження
1. **LLM-рев'ю не доводиться машинно.** JSON reviewer записує головна сесія. Компенсація: перевірка схеми і моделі, фінальний людський gate, CI.
2. **Bash можна обійти творчо** (написати скрипт, що читає файл). Guard ловить типові шляхи; повний захист — sandbox ОС (`/sandbox`), не ввімкнено, бо ламає частину інструментів; варто ввімкнути для неперевірених репо.
3. **Path guards у frontmatter агентів** спрацьовують лише коли роль викликано як subagent.
4. **Модель subagent** перевіряється на вході (guard на `Agent`), але фактичну модель у транскрипті видно лише вручну (сценарії 1–2 selftest перевіряють логіку маршрутизації, не API).
5. **Branch protection недоступний:** репо приватне на безкоштовному плані GitHub (рішення D-010). Захист `main`/`stage` — лише локальні guard-и, git hooks і CI; GitHub сам не заблокує merge з червоним CI — перед merge користувач перевіряє статус CI вручну.
6. Користувач може обійти будь-що (`git commit --no-verify` у власному терміналі) — це свідомо: фінальний контроль за людиною.
