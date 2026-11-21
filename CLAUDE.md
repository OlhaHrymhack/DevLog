# DevLog

Трекер задач для інженерної команди з вбудованими AI-агентами (пріоритизація, декомпозиція, статус-апдейти).
Тестове завдання: важливі чіткі рішення, читабельний код і чесна документація, а не кількість фіч.
Бектлог — `.factory/tasks.md`; статус задач — `node .factory/bin/factory.mjs status`.

## Процес: AI Development Factory
Будь-яка зміна коду застосунку йде через skill `/factory <DEV-xxx>` (orchestrator) — див. `docs/vault/architecture/factory.md`.
Етапи: Discovery → Planning → Approval → Implementation → Review → Security → Testing → QA → Final approval → PR → Docs → Retro.
Правила процесу, безпеки й тестів — у `.claude/rules/` (завантажуються автоматично). Ключове:
- код змінюється лише в статусі IMPLEMENTING погодженої задачі (enforced hook-ом);
- approval дає лише користувач текстом `APPROVE <ID>` / `APPROVE-FINAL <ID>`;
- стан і evidence — лише через `node .factory/bin/factory.mjs`; результати не вигадуємо;
- reviewer і security — окремі subagents на opus; merge PR — лише користувач.
Контекст проєкту для агентів: `docs/vault/now.md`, `docs/vault/project.md`, `docs/vault/decisions.md`.

## Стек
- Next.js (App Router) + TypeScript `strict`, npm
- API: Next.js Route Handlers (REST) у `src/app/api/**`
- БД: SQLite (`better-sqlite3`) + Drizzle ORM
- Валідація: Zod — одна схема на сутність, спільна для API, форм і tools агентів
- UI: Tailwind CSS + shadcn/ui, серверний стан — TanStack Query
- AI: `@anthropic-ai/sdk`, модель з `ANTHROPIC_MODEL` (default `claude-opus-5-5`)
- Логи: `pino`
- Тести: Vitest

## Структура (FSD на клієнті + DDD на сервері — повні правила в `.claude/rules/code-style.md`)
```
src/
  app/        # Next.js routing — тонкі page/layout/route.ts: parse → service → response
  views/      # FSD-сторінки
  widgets/    # Board, TaskPanel, DayPlanPanel, AgentTrace
  features/   # createTask, filterTasks, decomposeTask, statusUpdate, triageInbox
  entities/   # task, note, agentRun — ui + model (Zod-схеми, типи)
  shared/     # ui (shadcn), lib (загальні утиліти/хелпери), config, api
  server/     # tasks/ (domain, repository, service), db/, agents/ (core: runAgent, tools; <name>/), logger
```
Компоненти: function declaration, папка `TaskCard/` з `index.tsx`, `types.ts`, `styles.ts`.

## Правила коду
- Вхідні дані валідуються Zod на кожній межі: HTTP body/query, tool input агента, фінальний output агента.
- Доступ до БД — тільки через `server/tasks/repository.ts`. Route handlers і tools агентів не пишуть SQL самі.
- Без `any`, без `as` для обходу типів. Типи виводяться зі схем (`z.infer`), не дублюються руками.
- Помилки API — єдиний формат `{ error: { code, message, details? } }` з правильним HTTP-статусом.
- Імена: папки компонентів `PascalCase`, slices/модулі/функції `camelCase`, константи `SCREAMING_SNAKE_CASE` (таблиця — у `code-style.md`).
- Не додавай залежність без потреби; якщо додаєш — скажи, навіщо.
- Без закоментованого коду і `console.log` — тільки `logger`.

## Правила AI-агентів (in-product)
- Агент = власний loop у `server/agents/core/runAgent.ts`: виклик моделі → виконання tools → повтор, поки `stop_reason === "tool_use"`.
- Обов'язково: ліміт кроків, обробка `is_error` у tool_result, обробка `refusal` / `max_tokens`.
- Кожен крок пишеться в `agent_steps`, кожен запуск — в `agent_runs` (це наш trace для UI і дебагу).
- Фінальний результат — через tool `submit_result` зі strict-схемою, потім Zod-валідація + перевірка фактів (напр. що `taskId` існує).
- Агент не змінює дані без підтвердження користувача (створення підзадач, злиття задач — тільки після «Confirm» в UI).
- `AI_MOCK=true` — детерміновані відповіді без API-ключа; кожен агент повинен мати mock.
- Ніколи не логувати API-ключ і повні промпти з даними користувача на рівні `info`.

## Команди
- `npm run dev` — запуск (БД створюється автоматично)
- `npm run lint` / `npm run typecheck` / `npm test`
- `npm run db:seed` — демо-дані

## Як працювати зі мною (Claude Code)
- Спілкування — українською. Якщо щось у ТЗ неоднозначне — питай, а не вгадуй.
- НЕ редагуй розділ README «Рішення і компроміси» — його пише автор вручну (заблоковано hook-ом).
- НЕ пиши `AGENT_LOG.md` від імені автора; можна лише пропонувати факти (що згенеровано, що змінено). Сировина — `.claude/prompt-log.md` і `docs/vault/errors/`.
