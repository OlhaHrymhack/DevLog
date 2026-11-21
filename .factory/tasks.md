# DevLog — бектлог фабрики

> Людиночитний бектлог. **Джерело правди про статус — `node .factory/bin/factory.mjs status`** (`.factory/workflow-state.json`).
> Одна задача = один PR. Tier визначає architect на етапі PLANNING; тут — лише попередня оцінка.
> Бюджет ТЗ: 8–10 год. Кандидат на виріз першим — DEV-011.

| ID | Задача | Залежить від | Попередній tier |
|---|---|---|---|
| DEV-001 | Ініціалізація Next.js (App Router, TS strict), ESLint/Prettier, Vitest, Playwright, скрипти `typecheck/lint/test/test:e2e`, `prepare` → `git config core.hooksPath .githooks` | — | balanced |
| DEV-002 | Шар даних: SQLite + Drizzle, схема `tasks` (+`parentId`), `agent_runs`/`agent_steps`, авто-міграція при старті, `repository.ts`, Zod-схеми | DEV-001 | strong |
| DEV-003 | REST API задач: CRUD, фільтр за статусом, сортування, єдиний формат помилок, pino-логер | DEV-002 | balanced |
| DEV-004 | Seed-скрипт: ~12 реалістичних задач різного віку/статусу | DEV-002 | fast |
| DEV-005 | UI: layout, список задач, фільтр/сортування, стани loading/empty/error (shadcn/ui, TanStack Query) | DEV-003 | balanced |
| DEV-006 | UI: створення/редагування/видалення, сторінка задачі з підзадачами | DEV-005 | balanced |
| DEV-007 | AI-ядро: Anthropic client, `runAgent` loop (ліміт кроків, is_error, refusal/max_tokens), реєстр tools з Zod, `submit_result` + валідація + fallback, `AI_MOCK`, trace у БД | DEV-002 | strong |
| DEV-008 | Агент A — пріоритизація «з чого почати день» (+ перевірка існування taskId) | DEV-007 | strong |
| DEV-009 | Агент B — декомпозиція: уточнення при нечіткій задачі, перегляд/редагування, створення лише після підтвердження | DEV-007, DEV-006 | strong |
| DEV-010 | Агент C — статус-апдейт у стилі Slack, вибір тону | DEV-007 | balanced |
| DEV-011 | Агент D — власна ідея (Triage Inbox або Stale Task Detective) | DEV-007 | strong |
| DEV-012 | UI trace агента: кроки, tools, токени, тривалість | DEV-007, DEV-005 | balanced |
| DEV-013 | README (запуск, архітектура, дизайн агентів) + `.env.example` | усі фічі | fast |
| DEV-014 | Перевірка з нуля: clone → `npm install && npm run dev`; Loom (вручну) | DEV-013 | fast |

## Пише автор (не задачі фабрики)
- `AGENT_LOG.md` — веду по ходу; сировина: `.claude/prompt-log.md`, `docs/vault/errors/`.
- README → «Рішення і компроміси» — без AI (заблоковано hook-ом для агентів).

## Свідомо не робимо
- Авторизацію, деплой — за ТЗ не потрібно.
- Streaming відповідей агента в UI — trace після завершення; кандидат у «що далі».
