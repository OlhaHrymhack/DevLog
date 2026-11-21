# DevLog — бектлог фабрики

> Людиночитний бектлог. **Джерело правди про статус — `node .factory/bin/factory.mjs status`** (`.factory/workflow-state.json`).
> Одна задача = один PR через `/factory <ID>`. Tier визначає architect у PLANNING; тут — попередня оцінка. Повні AC — у плані задачі (`.factory/task-plans/<ID>.md`); тут — ключові.
> Джерело правди для UI — `docs/design/DESIGN.md` (+ `tokens.css`, референс поведінки `prototype.html`). Відхилення — нижче.

## Відхилення від DESIGN.md (D-014)
1. **Імена slices — camelCase** за стайл-гайдом (`features/taskCreate`, `widgets/dayPlanPanel`), а не kebab-case з §6. Папки компонентів — PascalCase (`TaskRow/index.tsx`).
2. **Агенти — на сервері.** Цикл, tools, детерміновані правила (`scoreTask`, `rulePlan`, `isVague`, `pickTone`, `diagnose`) і fallback — у `src/server/agents/<agent>/`. `features/*` містять лише UI і хук, що викликає `/api/agents/*`. `getHeat` — у `entities/task/model` (потрібен і клієнту, і серверу).
3. **Серверний стан — TanStack Query**, а не `taskStore.ts`.
4. **Живі кроки агента** — NDJSON-стрім із route handler (кожен крок — подія); «Зупинити» = abort запиту → `AbortSignal` у циклі агента.

## Задачі
| ID | Задача | Ключові AC | Залежить | Tier |
|---|---|---|---|---|
| **Основа** | | | | |
| DEV-001 | **Каркас** | Next.js App Router + TS strict, npm; Tailwind + shadcn init; Vitest + Playwright; pino; `shared/config/env.ts` (Zod, `aiMode` = live/demo); `.env.example`; `prepare` → `.githooks`; **ESLint зі стайл-гайдом**: function declaration, без default export поза `src/app`, межі шарів FSD і public API (`eslint-plugin-boundaries`); `typecheck/lint/test/test:e2e` зелені | — | balanced |
| DEV-002 | **UI Kit** | токени з `tokens.css` → `globals.css` + Tailwind theme (§2.6) + змінні shadcn; Inter / JetBrains Mono через `next/font`; ThemeToggle (dark за замовчуванням, без мерехтіння при завантаженні); `shared/ui`: shadcn-компоненти + Button (primary · ghost · danger · danger-ghost · ai; sm · md · icon), EmptyState (neutral · humor · error); `entities/task/ui`: StatusBadge, PriorityLabel, HeatBadge (+tooltip), TaskRow/TaskCard; `entities/agent-run/ui`: AgentPanel, AgentStepList, AgentProgress, AgentFallbackAlert, AgentTag; `getHeat` + `heatLevels` з unit-тестами на всі 7 рівнів; сторінка **`/ui-kit`** — усі компоненти, варіанти й стани в обох темах; `prefers-reduced-motion`; контраст AA | 001 | balanced |
| DEV-003 | **Дані** | SQLite + Drizzle: `tasks` (+`dueAt`, `updatedAt`, `focusRank`), `subtasks` (`source: user\|ai`), `notes`, `agent_runs`, `agent_steps`; авто-міграція при старті; repository — єдиний доступ до БД; Zod-схеми в `entities/*/model`; `updatedAt` оновлюється при зміні статусу/підзадач/нотаток; `db:seed` — 12 задач, що покривають усі рівні температури і всі сценарії агента D | 001 | strong |
| DEV-004 | **API задач** | CRUD `/api/tasks`; `?status=&sort=priority\|createdAt&order=&q=`; підзадачі й нотатки; помилки `{error:{code,message,details?}}` 400/404/500; логи запитів; integration-тести | 003 | balanced |
| **Трекер** | | | | |
| DEV-005 | **Список задач** | AppHeader; StatusFilter, SortSelect, TaskSearch; TaskList: таблиця ≥1024 / картки 2 колонки / 1 колонка + FAB на мобілці; стани: скелетон, empty «Нічого не горить», «немає за фільтром» + «Скинути», error + retry; DemoModeBanner; температура в рядку + HeatLegendDialog; гарячі клавіші `/`, `N`, `Esc`; «Серйозний режим» + `copy.uk.ts` (гумор лише в мікрокопі) | 002, 004 | balanced |
| DEV-006 | **Створення / редагування / видалення** | CreateTaskDialog, EditTaskDialog, DeleteTaskDialog (без жартів); TaskForm зі спільною Zod-схемою; помилки під полем + фокус на першу; bottom sheet на мобілці; повернення фокусу; тости | 005 | balanced |
| DEV-007 | **Деталі задачі** | `/tasks/[id]`: TaskOverview, StatusSelect / PrioritySelect, SubtaskList з чекбоксами, NoteList + AddNoteForm; 2 колонки на desktop / вкладки «Задача · Підзадачі · Апдейт» на tablet і mobile; «Задачу не знайдено», error + retry | 006 | balanced |
| **AI** | | | | |
| DEV-008 | **Ядро агентів** | `runAgent`: ліміт кроків, `is_error`, `refusal` / `max_tokens`, `AbortSignal`; реєстр tools з Zod-input; `submit_result` → Zod + перевірка, що всі id існують → 1 повтор → **fallback** (детерміноване правило); demo-режим без ключа (детерміновані моки для кожного агента); trace в `agent_runs` / `agent_steps`; NDJSON-стрім кроків; клієнтський `useAgentRun` (idle → running → result \| clarify \| fallback → applied, «Зупинити»); unit-тести циклу з фейковим клієнтом | 003 | strong |
| DEV-009 | **Агент A — План на день** | вага: пріоритет, вік, днів без змін, in-progress, дедлайн; top-3 з поясненням + «Відкладено»; fallback `rulePlan` з alert; «Застосувати порядок» → діалог → `focusRank` (статуси не змінюються) → бейдж «Фокус #N»; права колонка / згорнута картка | 008, 005 | strong |
| DEV-010 | **Агент B — Декомпозиція** | `isVague` → clarify: питання + відповідь (зберігається нотаткою); 3–6 підзадач без дублів; чекбокси + «Створити N підзадач» (`source: ai`); нічого не створюється без підтвердження | 008, 007 | strong |
| DEV-011 | **Агент C — Статус-апдейт** | авто-тон (ризик / дедлайн / гаряча → «Для менеджера», інакше «Для команди») + ручний вибір; мало даних → підказка додати нотатку; перевірка фактів (лише реальні підзадачі / нотатки); друк посимвольно; «Скопіювати»; нічого не надсилає | 008, 007 | balanced |
| DEV-012 | **Агент D — Радар застряглих** | in-progress ≥ 3 днів без змін; `diagnose`: «Чекає на ревʼю» → чернетка запиту, «Задача розмита» → перехід у B з автозапуском, «Завелика» → чернетка прохання про допомогу; кожна дія — окрема кнопка; «Ігнорувати» до наступного сканування | 008, 010 | strong |
| **Здача** | | | | |
| DEV-013 | **README + перевірка з нуля** | запуск, архітектура, дизайн 4 агентів (кроки, tools, коли зупиняється, structured output, валідація, хибні кейси), абзац «навіщо D»; E2E smoke у demo-режимі; clean clone → `npm install && npm run dev` | усі | fast |

**Порядок:** 001 → 002 → 003 → 004 → 005 → 006 → 007; 008 можна вести паралельно після 003; далі 009 → 010 → 011 → 012 → 013.

**Ризик бюджету:** 13 PR — більше, ніж 8–10 год ТЗ. Якщо не встигаємо, вирізаємо в такому порядку: гарячі клавіші і «Серйозний режим» (DEV-005) → друк посимвольно (DEV-011) → DEV-012.

## Пише авторка (не задачі фабрики)
- `AGENT_LOG.md`; сировина — `.claude/prompt-log.md`, `.factory/guard-log.jsonl`, `docs/vault/errors/`.
- README → «Рішення і компроміси» (без AI, заблоковано hook-ом).
- Loom (опційно).

## Свідомо не робимо
Авторизацію, кількох користувачів і assignees, drag-and-drop, реальну відправку в Slack, деплой.
