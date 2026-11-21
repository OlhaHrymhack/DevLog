---
tags: [now]
---
# Зараз (короткий зріз, ≤ 40 рядків, перезаписується)

Оновлено: 2026-11-21.

## Стан
- Фабрика готова: selftest 81/81, guard-log, PR-only workflow — [[architecture/factory]], [[decisions]] D-011, D-012.
- Codex CLI підключено (ChatGPT, `gpt-6.2-sol`, D-009). gstack — лише skills із Master Prompt.
- Стайл-гайд коду: `.claude/rules/code-style.md` — FSD на клієнті, DDD у `src/server/` (D-013).
- Дизайн-система з Claude Design — `docs/design/` (DESIGN.md, tokens.css, prototype.html); адаптація — D-014.
- **Продукт — [[product]]:** концепт, скоуп MVP, матриця вимог ТЗ R-01…21 → DEV, тест-кейси TC-01…75. Джерело правди про продукт.
- Бектлог: 13 задач DEV-001…013 — `.factory/tasks.md`. Агент D — «Радар застряглих».
- **Специфікації задач — [[specs/README]]:** по файлу на задачу (реалізація, контракти, мікрокопі з прототипу, AC з тестами), порядок виконання і протокол відновлення контексту.
- Коду застосунку ще немає.

## PR
- Змерджено в `stage`: #1 (фабрика), #2 (стайл-гайд), #3 (`retitle`/`remove`), #4 (guard для записів фабрики), #5 (дизайн-система + бектлог).
- Чекає merge: #6 `docs/product-concept` (product.md + specs/DEV-001…013).

## Далі
1. Питання зі specs вирішено (D-015). Користувачка мерджить #6.
2. `/factory DEV-001` (каркас) від актуального `stage` → план → `APPROVE DEV-001`.
3. Потім DEV-002 (UI Kit зі сторінкою `/ui-kit`).

## Відкрите
- Хибне спрацювання guard на слово «secrets» — рішення за користувачкою (`errors/2026-11-21-guard-false-positive-word-secrets.md`).
- Текст ТЗ (PDF) лежить поза репо; субагенти бачать його через [[product]].
- Live ще не перевірено: reviewer на opus, повний `/codex review`, проходження всіх gates (буде на DEV-001).
