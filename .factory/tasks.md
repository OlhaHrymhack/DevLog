# DevLog — бектлог фабрики

> Людиночитний бектлог. **Джерело правди про статус — `node .factory/bin/factory.mjs status`** (`.factory/workflow-state.json`).
> Одна задача = один PR через `/factory <ID>`. Tier визначає architect у PLANNING (8 критеріїв); тут — попередня оцінка. Повні AC — у плані задачі (`.factory/task-plans/<ID>.md`); тут — ключові.
> Джерело правди про продукт, вимоги ТЗ і тест-кейси (TC-xx) — `docs/vault/product.md`.
> **Детальна специфікація кожної задачі** (реалізація, контракти, мікрокопі з прототипу, AC з тест-кейсами) — `docs/vault/specs/DEV-xxx.md`; порядок виконання і протокол відновлення контексту — `docs/vault/specs/README.md`. Architect переносить AC зі специфікації в план без зміни нумерації. Таблиця нижче — короткий огляд.
> Джерело правди для UI — `docs/design/DESIGN.md` (+ `tokens.css`, референс поведінки й мікрокопі — `prototype.html`). Відхилення — нижче.

## Хто що робить (агенти фабрики)
Стандартний конвеєр кожної задачі:

| Етап | Агент · модель | Відповідає за | Обмеження (enforced) |
|---|---|---|---|
| Discovery | researcher · haiku | контекст, ризики, прогалини у вимогах | read-only |
| Planning | architect · opus | план, AC, оцінка складності → tier | пише лише `.factory/task-plans/` |
| Implementation | developer · **за tier** (fast → haiku, balanced → sonnet, strong → opus) | код + **unit-тести разом із кодом** (`<ID> AC-n` у назві) | без субагентів |
| Review | reviewer · **opus** (+ Codex для strong) | незалежне рев'ю у свіжому контексті | read-only, модель не знижується |
| Security | security · **opus** | OWASP, секрети, prompt injection, AI tools | read-only; обов'язковий, якщо security/integrations ≥ 1 |
| Testing / QA | qa · sonnet | **тест на кожен AC**, integration, **E2E критичного flow**, браузерна перевірка, скріншоти | **змінює лише тестові файли**; баг у коді → finding |
| Docs / Retro | docs · haiku | `docs/vault/` (now, decisions, features, errors, retro) | пише лише `docs/vault/` |

Колонка «Агенти» нижче показує **відхилення** від стандарту: `🔒` — security обов'язковий, `🎨` — qa додатково запускає gstack `/design-review` і звіряє з `prototype.html` і токенами (обидві теми, 375 / 768 / 1280px), `E2E` — qa пише Playwright-сценарій у demo-режимі, `Codex` — друге рев'ю іншою модельною сім'єю (усі strong).

## Відхилення від DESIGN.md (D-014)
1. **Імена slices — camelCase** за стайл-гайдом (`features/taskCreate`, `widgets/dayPlanPanel`), а не kebab-case з §6. Папки компонентів — PascalCase (`TaskRow/index.tsx`).
2. **Агенти — на сервері.** Цикл, tools, детерміновані правила (`scoreTask`, `rulePlan`, `isVague`, `pickTone`, `diagnose`) і fallback — у `src/server/agents/<agent>/`. `features/*` містять лише UI і хук, що викликає `/api/agents/*`. `getHeat` — у `entities/task/model` (потрібен і клієнту, і серверу).
3. **Серверний стан — TanStack Query**, а не `taskStore.ts`.
4. **Живі кроки агента** — NDJSON-стрім із route handler (кожен крок — подія); «Зупинити» = abort запиту → `AbortSignal` у циклі агента.
5. **Панель «Стани прототипу»** — лише в dev (`NODE_ENV !== 'production'`): примусові стани екрана, режим AI, «Зламати відповідь агента».

## Задачі
| ID | Задача | Ключові AC | Залежить | Tier | Агенти |
|---|---|---|---|---|---|
| **Основа** | | | | | |
| DEV-001 | **Каркас** | Next.js App Router + TS strict, npm; Tailwind + shadcn init; Vitest + Playwright; pino; `shared/config/env.ts` (Zod, `aiMode` = live/demo); `.env.example`; `prepare` → `.githooks`; **ESLint зі стайл-гайдом**: function declaration, без default export поза `src/app`, межі шарів FSD і public API (`eslint-plugin-boundaries`); `typecheck/lint/test/test:e2e` зелені | — | balanced | 🔒 (env, ключ) |
| DEV-002 | **UI Kit** | токени з `tokens.css` → `globals.css` + Tailwind theme (§2.6) + змінні shadcn; Inter / JetBrains Mono через `next/font`; ThemeToggle (dark за замовчуванням, **тема зберігається**, без мерехтіння при завантаженні); `shared/ui`: shadcn-компоненти + Button (primary · ghost · danger · danger-ghost · ai; sm · md · icon), EmptyState (neutral · humor · error); `entities/task/ui`: StatusBadge, PriorityLabel, HeatBadge (+tooltip), TaskRow/TaskCard; `entities/agent-run/ui`: AgentPanel, AgentStepList, AgentProgress, AgentFallbackAlert, AgentTag; `getHeat` + `heatLevels` з unit-тестами на всі 7 рівнів; сторінка **`/ui-kit`** — усі компоненти, варіанти й стани в обох темах; `prefers-reduced-motion`; контраст AA | 001 | balanced | 🎨 |
| DEV-003 | **Дані** | SQLite + Drizzle: `tasks` (+`dueAt`, `updatedAt`, `focusRank`), `subtasks` (`source: user\|ai`, **`estimate?`, `rationale?`**), `notes`, `agent_runs`, `agent_steps`; авто-міграція при старті; repository — єдиний доступ до БД; Zod-схеми в `entities/*/model`; `updatedAt` оновлюється при зміні статусу / підзадач / нотаток; `db:seed` — 12 задач **на основі `mockTasks()` прототипу**, що покривають усі рівні температури і всі сценарії агента D | 001 | strong | Codex |
| DEV-004 | **API задач** | CRUD `/api/tasks`; `?status=&sort=priority\|createdAt&order=&q=`; підзадачі (**створення, перемикання статусу, видалення**) і нотатки; помилки `{error:{code,message,details?}}` 400/404/500; логи запитів; integration-тести | 003 | balanced | 🔒 (вхідні дані) |
| **Трекер** | | | | | |
| DEV-005 | **Список задач** | AppHeader; StatusFilter, SortSelect, TaskSearch; TaskList: таблиця ≥1024 / картки 2 колонки / 1 колонка + FAB на мобілці; стани: скелетон, empty «Нічого не горить», «немає за фільтром» + «Скинути», error + retry; DemoModeBanner; температура в рядку + HeatLegendDialog; гарячі клавіші `/`, `N` **і `Т`** (кирилиця), `Esc`; «Серйозний режим» + `copy.uk.ts` (гумор лише в мікрокопі; перемикач лише в dev-панелі, D-015); **skip-link «Перейти до вмісту»**; **dev-панель «Стани прототипу»** | 002, 004 | balanced | 🎨 E2E (фільтр + сортування) |
| DEV-006 | **Створення / редагування / видалення** | CreateTaskDialog, EditTaskDialog, DeleteTaskDialog (без жартів); TaskForm зі спільною Zod-схемою; помилки під полем + фокус на першу; bottom sheet на мобілці; повернення фокусу; тости | 005 | balanced | 🎨 E2E (CRUD) |
| DEV-007 | **Деталі задачі** | `/tasks/[id]`: TaskOverview, StatusSelect / PrioritySelect, SubtaskList з чекбоксами, **видаленням** і **прогресом підзадач** + підказка «Усі підзадачі готові. Можна закривати задачу»; NoteList + AddNoteForm; 2 колонки на desktop / вкладки «Задача · Підзадачі · Апдейт» на tablet і mobile; «Задачу не знайдено», error + retry | 006 | balanced | 🎨 E2E (підзадачі + нотатки) |
| **AI** | | | | | |
| DEV-008 | **Ядро агентів** | `runAgent`: ліміт кроків, `is_error`, `refusal` / `max_tokens`, `AbortSignal`; реєстр tools з Zod-input; `submit_result` → Zod + перевірка, що всі id існують → 1 повтор → **fallback** (детерміноване правило); demo-режим без ключа (детерміновані моки для кожного агента); **fault injection «Зламати відповідь агента»** (лише dev) для демонстрації fallback; trace в `agent_runs` / `agent_steps`; NDJSON-стрім кроків; клієнтський `useAgentRun` (idle → running → result \| clarify \| fallback → applied, «Зупинити», **«Відхилити» з тостом**); unit-тести циклу з фейковим клієнтом | 003 | strong | 🔒 Codex |
| DEV-009 | **Агент A — План на день** | вага: пріоритет, вік, днів без змін, in-progress, дедлайн; top-3 з поясненням + «Відкладено»; fallback `rulePlan` з alert **і можливістю застосувати його** («Закріпити порядок за правилом?»); «Застосувати порядок» → діалог → `focusRank` (статуси не змінюються) → бейдж «Фокус #N»; права колонка / згорнута картка; **хибний кейс: посилання на неіснуючу задачу (#42) → повтор → fallback** | 008, 005 | strong | 🔒 🎨 E2E Codex |
| DEV-010 | **Агент B — Декомпозиція** | `isVague` → clarify: питання + відповідь (зберігається нотаткою); 3–6 підзадач **з оцінкою часу і поясненням**; чекбокси + «Створити N підзадач» (`source: ai`); нічого не створюється без підтвердження; **хибний кейс: дублікати наявних підзадач → відкинуто валідацією** | 008, 007 | strong | 🔒 🎨 E2E Codex |
| DEV-011 | **Агент C — Статус-апдейт** | авто-тон (гаряча+ або є дедлайн → «Для менеджера», інакше «Для команди») + ручний вибір з 5 тонів (Авто · Для команди · Для менеджера · Коротко · З гумором — прихований у серйозному режимі); fallback — шаблон «Коротко»; мало даних → підказка додати нотатку; перевірка фактів (лише реальні підзадачі / нотатки); друк посимвольно; «Скопіювати»; нічого не надсилає; **хибний кейс: згадка PR #999, якого немає в нотатках → «Факти не підтверджено»** | 008, 007 | balanced | 🔒 🎨 E2E |
| DEV-012 | **Агент D — Радар застряглих** | in-progress ≥ 3 днів без змін; `diagnose`: «Чекає на ревʼю» → чернетка запиту, «Задача розмита» → перехід у B з автозапуском, «Завелика» → чернетка прохання про допомогу, «Немає активності» → «Відкрити задачу»; fallback — лише «Відкрити задачу»; кожна дія — окрема кнопка; «Ігнорувати» до наступного сканування; **«Відхилити» чернетку з тостом** | 008, 010 | strong | 🔒 🎨 E2E Codex |
| DEV-016 | **Створення задачі голосом** | Підказка для диктування українською, чернетка з пріоритетом і дедлайном, підтвердження в наявній формі, приклад у demo | 006, 008 | balanced | 🔒 E2E |
| **Здача** | | | | | |
| DEV-013 | **README + перевірка з нуля** | запуск, архітектура, дизайн 4 агентів (кроки, tools, коли зупиняється, structured output, валідація, **хибні кейси з DEV-009/010/011**), абзац «навіщо D»; clean clone → `npm install && npm run dev` у demo-режимі; повний прогін `test` + `test:e2e`. E2E не пишемо тут — їх пише qa в кожній UI-задачі | усі | **balanced** (README пише sonnet, не haiku) | — |

| DEV-017 | **Підготовка DevLog до здачі** | README з інструкціями, локальний Docker зі збереженням даних, Vercel із демоданими, 10 спільних запусків на агента, перевірка артефактів | 008–013, 015 | strong | 🔒 E2E Codex |
| DEV-018 | **Лічильник спроб і квота публічного демо** | «Спроби AI» у шапці, по 50 спільних запусків для плану на день, радара й голосового вводу, сумарна межа 150 | 016, 017 | balanced | 🔒 E2E |

**Порядок:** 001 → 002 → 003 → 004 → 005 → 006 → 007; 008 можна вести паралельно після 003; далі 009 → 010 → 011 → 012 → 013.

**Ризик бюджету:** 13 PR — більше, ніж 8–10 год ТЗ. Якщо не встигаємо, вирізаємо в такому порядку: гарячі клавіші, «Серйозний режим» і dev-панель (DEV-005) → друк посимвольно (DEV-011) → DEV-012.

## Пише авторка (не задачі фабрики)
- `AGENT_LOG.md`; сировина — `.claude/prompt-log.md`, `.factory/guard-log.jsonl`, `docs/vault/errors/`.
- README → «Рішення і компроміси» (без AI, заблоковано hook-ом).
- Loom (опційно).

## Свідомо не робимо
Авторизацію, кількох користувачів і assignees, drag-and-drop, реальну відправку в Slack, деплой.
