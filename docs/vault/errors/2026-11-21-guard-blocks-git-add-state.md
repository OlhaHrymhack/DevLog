---
tags: [error]
task: backlog-design
stage: docs
agent: main session
---
# 2026-11-21 — Guard блокує `git add` файлу state фабрики

- **Що сталося:** після `factory retitle/remove` (state змінено легально через CLI) команда `git add` зі шляхом до `.factory/workflow-state.json` заблокована `checkFactoryIntegrity`: «записи фабрики змінюються лише через factory.mjs». Друга спроба (heredoc із текстом цієї нотатки, де згадано той самий шлях) — теж заблокована.
- **Причина:** правило забороняє будь-яку Bash-команду, текст якої містить шлях до state/evidence/approvals (крім `factory.mjs`), без розрізнення запису і staging/читання. `git add` вміст не змінює.
- **Що зроблено:** не обходила (`git add -A` дав би той самий результат в обхід правила). Нотатки записано через Write, решту закомічено; staging state — рішення користувачки.
- **Варіанти:** (1) користувачка стейджить файл сама (`! git add` цього файлу); (2) з погодження — дозволити в guard git-команди staging/читання (`git add`, `git diff`, `git log`, `git show`) для цих шляхів + сценарій у selftest.
