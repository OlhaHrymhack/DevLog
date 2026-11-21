# Правила фабрики: workflow

- Будь-яка зміна коду застосунку (`codeGlobs` у `.factory/project.config.json`) — тільки через задачу і skill `/factory`. Hook заблокує Edit/Write коду поза статусом IMPLEMENTING або без approval.
- Один PR = одна логічно завершена задача з Task ID (`DEV-xxx`).
- **Будь-яка зміна** (код, документація, сама фабрика) — тільки через фіча-гілку від `stage` (`feat/…`, `docs/…`, `factory/…`) і PR **у `stage`** (`gh pr create --base stage`). Коміти прямо в `main`/`stage`, push у них і merge — заборонені (enforced hook-ом). Merge PR у `stage` і `stage` → `main` робить лише користувач після свого approval.
- Approval пише тільки людина: `APPROVE <ID>` / `APPROVE-FINAL <ID>`. Ніколи не імітуй і не перефразовуй approval.
- Стан, evidence, approvals змінюються лише через `node .factory/bin/factory.mjs`. Markdown-чекбокс — не доказ.
- Звіти агентів (JSON) зберігай поза репозиторієм (`/tmp/...`), інакше вони змінять tree hash і зроблять evidence застарілим.
- Не вигадуй результати перевірок. Не кажи «готово», якщо `factory verify` не зелений.
- Зміни самої фабрики (hooks, CLI, settings, rules) — лише з погодження користувача; одна випадкова помилка не привід міняти глобальні правила.
- Комунікація з користувачем — українською.
