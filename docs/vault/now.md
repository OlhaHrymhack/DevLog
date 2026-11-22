---
tags: [now]
---
# Зараз (короткий зріз, ≤ 40 рядків, перезаписується)

Оновлено: 2026-11-22.

## Стан
- Фабрика готова: PR-only workflow, guard-log — [[architecture/factory]], [[decisions]] D-011, D-012, D-027, D-028.
- **Продукт — [[product]]:** скоуп MVP, R-01…21, TC-01…75. Специфікації — [[specs/README]].
- Змерджено задачі застосунку, зокрема DEV-008 (ядро агентів, D-029), DEV-015 (ліміти й dev-smoke, D-030) і DEV-009 (агент A «План на день», D-031).
- Фіча: [[features/dayPlan]].

## PR
- Змерджено в `stage`: #24 (DEV-015), #25 (DEV-009).
- Docs-етап DEV-009: гілка `docs/dev009-docs` (цей PR).

## Далі
1. DEV-010 «Агент B: Декомпозиція» — `/factory DEV-010` від актуального `stage`, план, `APPROVE DEV-010`.

## Відкрите
- Рішення користувачки: порядок fallback (urgent-first) розходиться зі спекою DEV-009 і копією в UI.
- Follow-up DEV-009: CSRF/Origin на `/api/agents/*`, `FACTOR_PATTERN` (підрядки), `list_active_tasks` без `truncated`, текст fallback не залежить від причини.
- Кандидат на маленьку задачу: зрозуміле повідомлення smoke на порожній БД ([[errors/2026-11-22-dev009-fallback-invalid]]).
- Хибне спрацювання guard на слово «secrets» (`errors/2026-11-21-guard-false-positive-word-secrets.md`).
- Живий smoke (TC-28) виконує користувачка вручну.
