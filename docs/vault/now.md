---
tags: [now]
---
# Зараз (короткий зріз, ≤ 40 рядків, перезаписується)

Оновлено: 2026-11-21.

## Стан
- Фабрика готова: selftest 81/81 (з PR #4), guard-log, PR-only workflow — [[architecture/factory]], [[decisions]] D-011, D-012.
- Codex CLI підключено (ChatGPT, `gpt-6.2-sol`, D-009). gstack — лише skills із Master Prompt.
- Стайл-гайд коду: `.claude/rules/code-style.md` — FSD на клієнті, DDD у `src/server/`, slices camelCase, компоненти — function declaration у папці PascalCase (`index.tsx`, `types.ts`, `styles.ts`) — D-013.
- Дизайн-система з Claude Design — `docs/design/` (DESIGN.md, tokens.css, prototype.html); адаптація до архітектури — D-014.
- Бектлог: 13 задач DEV-001…013 з AC і ролями агентів — `.factory/tasks.md`. Агент D — «Радар застряглих».
- Коду застосунку ще немає.

## PR
- Змерджено в `stage`: #1 (фабрика), #2 (стайл-гайд), #3 (`retitle`/`remove`).
- Чекають merge користувачкою: #4 (guard дозволяє `git add/diff/log/show/status/commit` для записів фабрики), #5 (дизайн-система + бектлог + цей зріз).

## Далі
1. Користувачка мерджить #4 → #5, перезапускає сесію.
2. `/factory DEV-001` (каркас) від актуального `stage` → план → `APPROVE DEV-001`.
3. Потім DEV-002 (UI Kit зі сторінкою `/ui-kit`).

## Відкрите
- Хибне спрацювання guard на слово «secrets» — рішення про звуження за користувачкою (`errors/2026-11-21-guard-false-positive-word-secrets.md`).
- Live ще не перевірено: reviewer на opus, повний `/codex review`, проходження всіх gates реальною задачею (буде на DEV-001).
