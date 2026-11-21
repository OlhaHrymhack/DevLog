---
tags: [now]
---
# Зараз (короткий зріз, ≤ 40 рядків, перезаписується)

- Фабрика налаштована і перевірена selftest-ом (66/66) — [[architecture/factory]].
- gstack 1.102.1 встановлено (лише потрібні skills), Codex CLI 0.171.0 встановлено — потрібен `codex login`.
- Гілки: feature → stage → main; merge робить лише користувач — [[decisions]] D-006.
- Codex підключено (ChatGPT, `gpt-6.2-sol`, D-009). Репо приватне, без branch protection (D-010).
- Очікує користувача: перший push main + stage.
- Далі: ручна перевірка моделей subagents; потім огляд задач DEV-001…DEV-014 і старт DEV-001.
