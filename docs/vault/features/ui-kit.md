---
tags: [feature]
task: DEV-002
pr: https://github.com/OlhaHrymhack/DevLog/pull/12
---
# UI Kit і токени (DEV-002)

- **Що зроблено:**
  - Дизайн-токени з `docs/design/tokens.css` дослівно в `src/app/globals.css` (`@layer base`, теми dark і light); мапінг у Tailwind v4 через `@theme inline`, змінні shadcn посилаються на наші токени (D-022).
  - Шрифти через `next/font/google`: Inter (400/500/600/700) і JetBrains Mono (500), змінні `--font-sans` і `--font-mono` (`src/app/layout.tsx`).
  - shadcn-компоненти в `src/shared/ui/` у PascalCase-папках: Alert, Badge, Card, Checkbox, Dialog, Input, Progress, Select, Sheet, Skeleton, Sonner, Switch, Tabs, Textarea, Toggle, ToggleGroup, Tooltip. Власні: `Button` (варіанти primary · ghost · danger · danger-ghost · ai), `EmptyState`, `ResponsiveDialog`. Структура `index.tsx` + `types.ts` + `styles.ts` (стиль — D-023).
  - Сутності `entities/task`: `TaskStatusSchema`, `TaskPrioritySchema`, `getHeat` з 7 рівнями температури, `StatusBadge`, `PriorityLabel`, `HeatBadge`, `TaskRow`. Сутність `entities/agentRun`: типи й UI `AgentPanel`, `AgentStepList`, `AgentProgress`, `AgentFallbackAlert`, `AgentTag`.
  - Хелпери `src/shared/lib`: `plural`, `formatDate`, `daysBetween`, `ageLabel`, хук `useMediaQuery`.
  - Тема: `features/themeToggle` (dark за замовчуванням, `localStorage["devlog-theme"]`). Інлайн-скрипт у `<head>` ставить `data-theme` до гідратації, тому тема не мерехтить.
  - Сторінка `/ui-kit` (`views/uiKit`): у production викликає `notFound()`.
- **Acceptance criteria:**
  - AC-1: токени обох тем збігаються з `tokens.css` (`test/tokens.test.ts`).
  - AC-2: `getHeat(task, now)` для 7 рівнів і меж (`getHeat.test.ts`).
  - AC-3: `plural`, `ageLabel`, `formatDate`, `daysBetween` (`src/shared/lib/*.test.ts`).
  - AC-4: тема dark за замовчуванням, збереження, без мерехтіння (`e2e/theme.spec.ts`).
  - AC-5: варіанти компонентів доступні: aria-label, sr-текст, tooltip по фокусу й тапу (Testing Library, jsdom).
  - AC-6: `/ui-kit` показує всі компоненти в обох темах; production → 404 (`e2e/uiKit.spec.ts`, `src/app/ui-kit/page.test.tsx`).
  - AC-7: без горизонтального скролу на 375 / 768 / 1280 в обох темах; `TaskRow` — таблиця ≥ 1024, картка < 1024. AA-контраст і звірка з прототипом — QA (ручна частина).
  - AC-8: `prefers-reduced-motion` вимикає анімації (`e2e/uiKit.spec.ts`).
- **Як працює:**
  - Tooltip `HeatBadge` у контрольованому режимі: відкривається по hover і фокусу, на тач і за кліком перемикається тапом (`onPointerDown` / `onClick`). Radix закриває tooltip сам, тому стан тримаємо у компоненті (D-025).
  - Час передається параметром (`getHeat(task, now)`, `ageLabel(ts, now)`; `TaskRow` і `/ui-kit` отримують `now` пропсом) за планом DEV-002, щоб уникнути гідратаційних розбіжностей.
  - Типи виводяться з `schemas.ts` через `z.infer`. Пропси `TaskRow` і `getHeat` беруть `Pick` потрібних полів; повна `Task` з'явиться в DEV-003.
  - Стан задачі: balanced, реалізація в головній сесії, рев'ю sonnet; security не потрібен; QA обов'язковий (`ui=1`).
- **Обмеження / що свідомо не зроблено:**
  - Вага Inter 700 і tooltip на тач відрізняються від DESIGN §2.2 і §6. Підстава — специфікація `docs/vault/specs/DEV-002.md` (D-025).
  - Мерехтіння теми перевірене лише в E2E без гідратації, а не в реальному браузері. Перевірка — QA.
  - Tooltip на 375 і AA-контраст — ручна перевірка QA, не автотест.
  - `shadcn add` на Tailwind v4 з turbopack-loader перевірено лише для цієї задачі; нові shadcn-компоненти треба переносити вручну в `PascalCase/index.tsx` і виправляти імпорт на `@/shared/ui/Button` (D-022, D-023).
  - `next build` потребує мережі для Google Fonts (CI має мережу).
- **Помилки під час розробки:** окремого запису в `errors/` немає. Задача мала один цикл доопрацювання: після `AWAITING_FINAL_APPROVAL` вона повернулась в IMPLEMENTING. Причину в стані задачі не зафіксовано, тому її не реконструюємо.
- Пов'язано: [[specs/DEV-002]], [[decisions]] (D-013, D-014, D-022, D-023, D-025), [[product]].
