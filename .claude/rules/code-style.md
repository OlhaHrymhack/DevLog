---
paths:
  - "src/**"
---
# Стайл-гайд коду (DevLog)

Принципи: **DDD** (єдина доменна мова, логіка — в домені), **KISS** (найпростіше рішення, що працює), **Feature-Sliced Design** на клієнті. Рішення — `docs/vault/decisions.md` D-013. Перевіряється ESLint (DEV-001), не лише рев'ю.

## Архітектура
```
src/
  app/        # Next.js routing: лише тонкі page / layout / route.ts + провайдери. Без бізнес-логіки
  views/      # FSD-шар сторінок (назва "pages" конфліктує з Next.js)
  widgets/    # великі блоки екрану: Board, TaskPanel, DayPlanPanel, AgentTrace
  features/   # дії користувача: createTask, filterTasks, decomposeTask, statusUpdate, triageInbox
  entities/   # доменні сутності: task, note, agentRun — ui + model (Zod-схеми, типи)
  shared/     # ui (shadcn), lib (загальні утиліти й хелпери), config, api (HTTP-клієнт)
  server/     # DDD-модулі сервера: tasks/ (domain, repository, service), agents/ (core, prioritize, …)
```
- **Напрямок імпортів лише вниз:** `app → views → widgets → features → entities → shared`. Сусідні slices одного шару одне одного не імпортують.
- **Public API:** кожен slice експортує назовні лише через свій `index.ts`. Глибокі імпорти `features/x/ui/...` ззовні заборонені.
- **Сегменти slice:** `ui/`, `model/` (стан, схеми, типи), `api/` (запити), `lib/` (локальні хелпери), `config/`.
- **Загальні утиліти та хелпери** — лише в `src/shared/lib/`. Якщо хелпер потрібен одному slice — він живе в `lib/` цього slice.
- **Сервер (`src/server/`)** не імпортується клієнтськими шарами. Route handlers у `src/app/api/**`: parse (Zod) → service → response. Доступ до БД — лише через repository.
- **Контракти** (Zod-схеми сутностей) — у `entities/<entity>/model/`; ними користуються і клієнт, і сервер.

## Компоненти
- Компоненти й усі функції — **стрілкові `const`** з іменованим експортом:
  ```tsx
  export const TaskCard = ({ task, onStatusChange }: TaskCardProps) => { … };
  ```
  Не `function TaskCard() {}` (ESLint `func-style: expression`), не `export default`. Виняток — файли Next.js (`page.tsx`, `layout.tsx`, `route.ts` тощо), які вимагають `export default`: `const Page = () => …; export default Page;`.
- **Хуки** (функції, що викликають інші хуки React) називаються з префікса `use` (`useMediaQuery`); файл хука — `useX.ts` (імена файлів у `shared/lib/hooks` перевіряє `test/conventions.test.ts`). `react-hooks/rules-of-hooks` (з `eslint-config-next`) забороняє викликати хуки поза компонентами й функціями `use*`, але не перевіряє імена функцій, що хуки не викликають.
- **Структура компонента — папка в PascalCase:**
  ```
  TaskCard/
    index.tsx    # компонент (розмітка + мінімальна логіка відображення)
    types.ts     # props і локальні типи
    styles.ts    # Tailwind-класи через cva (варіанти: priority, status…)
  ```
  `types.ts` / `styles.ts` створюються, лише коли є що туди покласти (KISS) — порожніх файлів не робимо.
- Стилі не пишемо інлайном у розмітці, якщо їх більше одного-двох утилітарних класів — виносимо в `styles.ts`.
- Логіка (запити, мутації, обчислення) — у `model/` (хуки) або `lib/`, не в компоненті.
- **shadcn** (`src/shared/ui/`) не виняток: `shadcn add` створює плоский `alert.tsx` — переносимо в `Alert/index.tsx`, виправляємо імпорти на `@/shared/ui/Alert` і функції на стрілкові `const`. Файл із кількома частинами (`Dialog`, `Select`, `Tabs`…) лишається одним `index.tsx` з кількома іменованими експортами. Оверрайд `consistent-type-assertions` у `eslint.config.mjs` перелічує згенеровані папки вручну — новий shadcn-компонент додайте до списку. Плоскі `*.tsx` у `shared/ui` і function declaration у `src`, `test`, `e2e` та кореневих конфігах ловлять `func-style` і `test/conventions.test.ts`.

## Найменування
| Що | Стиль | Приклад |
|---|---|---|
| Папка компонента (і shadcn) | PascalCase | `TaskCard/`, `Alert/` |
| Файли всередині компонента | `index.tsx`, `types.ts`, `styles.ts` | — |
| Slice (папка в шарі FSD) | camelCase | `features/decomposeTask/` |
| Хуки | camelCase з `use` | `useTasks.ts` |
| Утиліти, модулі | camelCase | `formatAge.ts`, `taskRepository.ts` |
| Типи / інтерфейси | PascalCase | `Task`, `TaskCardProps` |
| Константи | SCREAMING_SNAKE_CASE | `MAX_AGENT_STEPS` |
| Файли Next.js | як вимагає Next.js | `page.tsx`, `route.ts` |

## Доменна мова (DDD)
Одні назви в коді, API, БД і UI: `Task`, `Subtask`, `Note`, `AgentRun`, `AgentStep`, `DayPlan`, `Decomposition`, `StatusUpdate`, `Triage`. Без синонімів (`Item`, `Issue`, `Ticket`).

## TypeScript
- `strict`, без `any` і без `as` для обходу типів; типи виводимо зі схем (`z.infer`), не дублюємо.
- Zod-валідація на кожній межі: HTTP, tool input агента, output агента, форми.
