---
tags: [now]
---
# Зараз (короткий зріз, ≤ 40 рядків, перезаписується)

Оновлено: 2026-11-22.

## Стан
- Код застосунку є: Next.js App Router + TS strict, Tailwind v4 + shadcn, Vitest, Playwright, стайл-гайд D-013 / D-023 — [[architecture/factory]].
- **DEV-001 Каркас** — PR #9 (стан фабрики: READY_FOR_PR, запис переходу в COMPLETED відсутній — уточнити).
- **DEV-002 UI Kit** — COMPLETED. Токени, shadcn-компоненти, `entities/task` і `entities/agentRun`, `themeToggle`, `/ui-kit` (404 у production) — [[features/ui-kit]].
- **DEV-014 Конвенції коду** — COMPLETED, PR #12. Стрілкові `const`, shadcn у PascalCase-папках — D-023.
- Метрики DEV-002: reworkCycles 1, failedVerify 0, blockingReviews 0, ~0.4 год до PR (`factory metrics DEV-002`).

## PR
- Змерджено: #9 (DEV-001), #12 (DEV-014, разом з DEV-002 за словами користувачки), #13 (повторне рев'ю фабрики, D-024).
- DEV-002 увійшов у змерджений PR #12 (разом з DEV-014); PR #11 лишається відкритим — його можна закрити без merge.

## Рішення останнього часу
- D-022: Tailwind v4 CSS-тема, власна `Button`, `sonner` без `next-themes` (DEV-002).
- D-023: стрілкові `const`, shadcn-компоненти в `PascalCase/index.tsx` (DEV-014).
- D-024: повторне рев'ю після ребейзу, `COMPLETED → REVIEWING` лише при зміні коду.
- D-025: Inter 700 за специфікацією, тема інлайн-скриптом у `<head>`, тач-tooltip у контрольованому режимі (DEV-002).

## Далі
1. `/factory DEV-003` «Шар даних» (BACKLOG) від актуального `stage` — спека [[specs/DEV-003]], план → `APPROVE DEV-003`.
2. Потім DEV-004 «API задач» (спека [[specs/DEV-004]]).

## Відкрите
- DEV-001: стан фабрики READY_FOR_PR, перехід у COMPLETED не записано. Звірити з GitHub і виправити стан через CLI.
- Закрити застарілий PR #11 (рішення користувачки).
- Ручна QA DEV-002: AA-контраст і звірка з прототипом (AC-7), tooltip на тач на 375. Автотестів на це немає.
- `next build` потребує мережі для Google Fonts. CI має мати доступ.
- Хибне спрацювання guard на слово «secrets» — рішення за користувачкою (`errors/2026-11-21-guard-false-positive-word-secrets.md`).
- Текст ТЗ (PDF) лежить поза репо; субагенти бачать його через [[product]].
