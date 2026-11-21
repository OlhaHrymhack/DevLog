# Журнал рішень (append-only)

> Лише дописувати в кінець. Переглянуте рішення — новий запис «Supersedes D-xxx». Hook блокує зміну старих записів.

## D-001 Фабрика розробки: lean-варіант на нативних механізмах Claude Code + gstack
- Дата: 2026-11-21
- Рішення: orchestrator — головна сесія (skill `/factory`), 7 subagents, gates через hooks + CLI `.factory/bin/factory.mjs` (0 залежностей), gstack глобально.
- Причина: бюджет ТЗ 8–10 год; reviewer-и ТЗ не повинні нічого встановлювати; не дублювати gstack.
- Альтернативи: повна фабрика з окремим orchestrator-агентом; team mode gstack у репо.
- Пов'язано: [[architecture/factory]]

## D-002 Evidence прив'язаний до tree hash, а не до commit SHA
- Дата: 2026-11-21
- Рішення: ключ evidence — `git write-tree` робочого дерева без `.factory/` і `docs/vault/`.
- Причина: до коміту SHA не існує; будь-яка зміна коду автоматично робить review/tests застарілими.
- Наслідок: звіти агентів треба зберігати поза репо, інакше вони самі змінюють hash (знайдено selftest-ом).

## D-003 Approval — лише з промпту користувача
- Дата: 2026-11-21
- Рішення: `UserPromptSubmit` hook ловить `APPROVE <ID>` / `APPROVE-FINAL <ID>`; запис approvals агентом заблоковано.
- Причина: агент не може підробити текст, який ввела людина; slash-команда тут ненадійна (розгортається як skill).

## D-004 Git hooks через core.hooksPath замість Husky
- Дата: 2026-11-21
- Рішення: `.githooks/` + `git config core.hooksPath .githooks` (у DEV-001 — через npm `prepare`).
- Причина: без зайвої залежності; працює ще до появи package.json.

## D-005 Fast-задачі пропускають етап QA
- Дата: 2026-11-21
- Рішення: для tier fast — без approval плану і без QA; review (opus), tests і фінальний approval лишаються.
- Причина: бюджет ТЗ; дрібні зміни не варті браузерного QA. Погоджено користувачем.

## D-006 Гілки: feature → stage → main
- Дата: 2026-11-21
- Рішення: фіча-гілки → PR у `stage`; merge у stage і stage → main (prod) робить лише користувач. Push у `stage`/`main` заблоковано guard-ом (`branches.protected`).

## D-007 gstack: лише skills з Master Prompt
- Дата: 2026-11-21
- Рішення: gstack 1.102.1 (stable) глобально; лишено 18 skills зі специфікації + `freeze`/`unfreeze` (залежність `/guard`); решту посилань прибрано з `~/.claude/skills`. `/test` у gstack не існує (це тест-сьют репо). Конфіг: proactive off (skills не запускаються самі в обхід /factory), routing off, update_check off (версія не дрейфує), telemetry off.
- Наслідок: `/gstack-upgrade` або повторний `./setup` поверне всі skills — після оновлення прибрати знову.

## D-008 Cross-family review для strong-задач
- Дата: 2026-11-21
- Рішення: strong-задачі (включно з ескальованими) потребують другого рев'ю через OpenAI Codex (`/codex`); evidence kind `codex`, gate 3 без нього не проходить.
- Причина: Claude-модель, що рев'ює Claude-код, має спільні сліпі зони. Ризик: код задачі надсилається в OpenAI.

## D-009 Модель Codex для cross-family review задається на рівні проєкту
- Дата: 2026-11-21
- Рішення: `GSTACK_CODEX_MODEL=gpt-6.2-sol` у `.claude/settings.json` (env). Глобальний `~/.codex/config.toml` не змінюємо.
- Причина: глобальна модель `gpt-5.4` не підтримується при вході через ChatGPT (перевірено `codex exec`); `gpt-6.2-sol` відповідає. Інші проєкти користувачки не зачіпаються.

## D-010 Репо лишається приватним, без branch protection
- Дата: 2026-11-21
- Рішення: приватний репозиторій; branch protection / rulesets недоступні на безкоштовному плані.
- Наслідок: захист гілок — guard-и Claude Code, `.githooks/`, CI; перед merge користувач вручну перевіряє зелений CI. Для здачі ТЗ — надати доступ рецензентам.
