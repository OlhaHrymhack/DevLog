# Правила фабрики: workflow

- Будь-яка зміна коду застосунку (`codeGlobs` у `.factory/project.config.json`) — тільки через задачу і skill `/factory`. Hook заблокує Edit/Write коду поза статусом IMPLEMENTING або без approval.
- Один PR = одна логічно завершена задача з Task ID (`DEV-xxx`).
- Approval пише тільки людина: `APPROVE <ID>` / `APPROVE-FINAL <ID>`. Ніколи не імітуй і не перефразовуй approval.
- Стан, evidence, approvals змінюються лише через `node .factory/bin/factory.mjs`. Markdown-чекбокс — не доказ.
- Звіти агентів (JSON) зберігай поза репозиторієм (`/tmp/...`), інакше вони змінять tree hash і зроблять evidence застарілим.
- Не вигадуй результати перевірок. Не кажи «готово», якщо `factory verify` не зелений.
- Зміни самої фабрики (hooks, CLI, settings, rules) — лише з погодження користувача; одна випадкова помилка не привід міняти глобальні правила.
- Комунікація з користувачем — українською.
