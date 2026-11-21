---
tags: [error]
task: factory-setup
stage: self-test
agent: main session
---
# 2026-11-21 — JSON-звіти агентів у корені репо інвалідували evidence

- **Що сталося:** selftest упав на 7 сценаріях: verify/review ставали «застарілими» одразу після запису security-звіту.
- **Причина:** звіти reviewer/security писалися у файли всередині робочого дерева → змінювали tree hash.
- **Як виявили:** `node .factory/bin/factory.mjs selftest` (сценарій 6b).
- **Як виправили:** звіти зберігаються поза репо (`/tmp`); правило в `.claude/rules/workflow.md` і skill `/factory`.
- **Як запобігти:** selftest покриває повний флоу; [[decisions]] D-002.
