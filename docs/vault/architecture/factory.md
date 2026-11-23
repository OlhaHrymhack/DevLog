---
tags: [architecture, factory]
---
# AI Development Factory

Універсальний процес розробки на Claude Code для TS / React / Next.js / Node проєктів. Проєктне — лише `.factory/project.config.json`, `CLAUDE.md` і `docs/vault/`.

## Конвеєр (D-016)
```
BACKLOG → DISCOVERY → PLANNING → AWAITING_APPROVAL → IMPLEMENTING → REVIEWING
  → QA (лише UI-задачі balanced/strong) → AWAITING_FINAL_APPROVAL → READY_FOR_PR → COMPLETED      (будь-де → BLOCKED)
  COMPLETED → REVIEWING — лише якщо код змінився після APPROVE-FINAL (ребейз на stage перед merge PR, D-024)
```
Реалізація + тести → `verify` → усі обов'язкові рев'ю (reviewer, security, codex для strong; якщо Codex недоступний — `codex-fallback`, D-027) для одного зафіксованого хешу → збір блокерів → виправлення одним пакетом і `verify` нового хешу → QA за потреби → фінальне погодження → PR (D-021). Тести пише developer в IMPLEMENTING, тому рев'ю бачить код разом із тестами, а правки тестів не анулюють рев'ю у звичайному проході.

| Етап | Агент | Модель | Вихід | Gate для виходу |
|---|---|---|---|---|
| Discovery + Planning | orchestrator (fast) · architect (balanced) · researcher + architect (strong) | — / sonnet / opus | `task-plans/<ID>.md`, CLASSIFY (+`ui`) | план за шаблоном, AC-n |
| Approval | **користувач** | — | `APPROVE <ID>` | Gate 1 (fast — без approval) |
| Implementation | developer (fast, strong) · головна сесія (balanced) | haiku / sonnet / opus | код + тести на кожен AC | Gate 2: `factory verify` (typecheck, lint, unit, AC traceability) |
| Review | reviewer (+ codex для strong) | sonnet (fast, balanced) · opus (balanced з підвищеним ризиком, strong) / OpenAI | JSON findings | Gate 3: без Critical/High |
| Security | security | opus (pinned) | JSON findings | Gate 4 (якщо security/integrations ≥ 1) |
| QA | qa | sonnet | `verify --full` + браузер, findings | Gate 5 + QA: balanced/strong з `ui=1` (без оцінки `ui` — обов'язково); e2e також, якщо план вимагає `verify --full`; QA не править код і тести |
| Final approval | **користувач** | — | `APPROVE-FINAL <ID>` | Gate 6, прив'язаний до tree hash |
| PR | orchestrator | — | гілка, коміт, PR (без merge) | pre-commit / pre-push / CI |
| Docs / Retro | docs | haiku | vault + `factory metrics` | — |

Orchestrator (головна сесія) — Sonnet за замовчуванням (`model` у `.claude/settings.json`): у перевіреному запуску основна сесія на Opus створила найбільший обсяг повторного читання контексту.

## Маршрутизація моделей
8 критеріїв × 0–2 бали (architect) + прапорець `ui` (0/1, не входить у суму). 0–3 fast · 4–8 balanced · ≥ 9 strong; security = 2 або integrations = 2 → завжди strong. **Tier визначає обсяг процесу і рівень рев'ю** (див. таблицю маршрутів у SKILL.md), а не модель developer.

**Tier і модель рахуються з балів** (`effectiveTier`, `effectiveModel` = модель tier + лише ручні `escalate`): у задач старої фабрики збережений tier міг бути підвищений ескалацією — на рев'ю, QA і codex він не впливає (D-017).

**Ескалації автоматично немає.** Червоний `verify` (відсутня залежність, конфіг, тести) → developer доробляє на поточній моделі. Повтор тієї самої помилки (відбиток провалених перевірок і хвоста виводу) → CLI каже про повтор, модель не змінюється. Складний дефект після цільового виправлення → orchestrator: `factory escalate <ID> <причина>` — підвищує лише модель developer; tier, рівень рев'ю і codex лишаються. Захист від нескінченних циклів: 3 **різні** невдалі спроби з developer на opus → BLOCKED і питання користувачу; повтор тієї самої діагностики лічильник не збільшує (рахується окремо як `repeatedFailures` у metrics).

## Метрики
`factory usage <ID> <role> <tokens>` — токени субагента (orchestrator записує після кожного виклику). `factory metrics [ID]` — токени за ролями, цикли доопрацювання, провали verify/review, години до PR. Токени головної сесії — вручну з `/cost`. На найближчих задачах порівнюємо ці три числа, щоб перевірити, що фабрика подешевшала без зростання переробок.

## Механізми контролю
| Що | Де | Тип |
|---|---|---|
| Секрети (.env*, ключі, credentials; дозволено `.env.example`) | `permissions.deny` + `pre-tool-guard.mjs` (Read/Edit/Write/Grep/Glob/Bash) | блок |
| Деструктивні команди, force push, push у main, merge, `--no-verify`, `reset --hard` | `pre-tool-guard.mjs` + deny | блок |
| Код лише в IMPLEMENTING з чинним approval; зміна плану анулює approval | `pre-tool-guard.mjs` (workflow gate) | блок |
| State / evidence / approvals — лише CLI; approval — лише промпт людини | guard + `user-prompt.mjs` | блок |
| Зміна hooks / CLI / settings | guard | запит підтвердження |
| reviewer не нижче моделі tier (`reviewModel`), security — opus | guard на `Agent` + перевірка у `factory record` | блок |
| Звіти review/codex/security — лише для хешу, зафіксованого при вході в REVIEWING; правки (REVIEWING → IMPLEMENTING) — після всіх обов'язкових звітів (D-021) | `factory record` + `transition` | відхилення |
| Права ролей (architect → плани, qa → лише `test-results/`, docs → vault) | `path-guard.mjs` у frontmatter агентів | блок |
| `AGENT_LOG.md`, README «Рішення і компроміси» — лише автор | guard | блок |
| `decisions.md` append-only | guard | блок |
| Незверифіковані зміни коду, зроблені **цією сесією** (база — відбиток `codeGlobs` на `SessionStart`, поза репо) | `stop.mjs` | нагадування (1 раз за хід); зміни фабрики/docs не блокуються |
| Відновлення після перерви | `session-start.mjs` + `factory resume` (tier/модель за балами, наступна дія з gates) | контекст |
| Коміт коду лише з зеленими gates для staged tree; push — з фінальним approval | `.githooks/pre-commit`, `pre-push` | блок |
| Незалежна перевірка поза машиною розробника | `.github/workflows/ci.yml` | блок PR |

## gstack (глобально, `~/.claude/skills/gstack`, v1.102.1 stable)
Встановлено лише skills зі специфікації (D-007): `/office-hours`, `/plan-ceo-review` (Discovery — лише за запитом користувача, бізнес-вимоги не вигадуємо) · `/plan-eng-review`, `/plan-design-review` (architect) · `/review` (reviewer, без авто-фіксів) · `/codex` (друге рев'ю для strong за класифікацією, D-008/D-016) · `/cso` (security; Docker є → повний режим) · `/qa`, `/qa-only`, `/design-review`, `/test-audit` (qa) · `/verify` (developer) · `/ship` (PR у stage, без merge) · `/careful`, `/guard` (+`freeze`/`unfreeze`) · `/retro`, `/learn` (docs). `/test` у gstack не існує.

## Гілки (D-006)
`feat/<ID>-<slug>` → PR у `stage` → (користувач) merge → `stage` → (користувач) merge → `main` (prod). Push у `stage`/`main` і `gh pr merge` заблоковано.

## Як користуватися
- `/factory DEV-001` — провести задачу; `/factory status`; `/factory new <опис>`.
- Погодити план: написати `APPROVE DEV-001`. Перед PR: `APPROVE-FINAL DEV-001`.
- `node .factory/bin/factory.mjs line` — один рядок: tier, хто/на чому реалізує, модель рев'ю (заплановано/підтверджено), наступна дія; `report` — повний звіт; `... selftest` — перевірка самої фабрики.

## Чесні обмеження
1. **LLM-рев'ю не доводиться машинно.** JSON reviewer записує головна сесія. Компенсація: перевірка схеми і моделі, фінальний людський gate, CI.
2. **Bash можна обійти творчо** (написати скрипт, що читає файл). Guard ловить типові шляхи; повний захист — sandbox ОС (`/sandbox`), не ввімкнено, бо ламає частину інструментів; варто ввімкнути для неперевірених репо.
3. **Path guards у frontmatter агентів** спрацьовують лише коли роль викликано як subagent.
4. **Модель subagent** перевіряється на вході (guard на `Agent`), але фактичну модель у транскрипті видно лише вручну (сценарії 1–2 selftest перевіряють логіку маршрутизації, не API).
5. **Branch protection недоступний:** репо приватне на безкоштовному плані GitHub (рішення D-010). Захист `main`/`stage` — лише локальні guard-и, git hooks і CI; GitHub сам не заблокує merge з червоним CI — перед merge користувач перевіряє статус CI вручну.
6. Користувач може обійти будь-що (`git commit --no-verify` у власному терміналі) — це свідомо: фінальний контроль за людиною.
