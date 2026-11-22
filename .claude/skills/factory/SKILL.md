---
name: factory
description: Orchestrator AI Development Factory — веде задачу циклом Discovery/Planning → Approval → Implementation (код + тести) → Review → Security → QA (UI) → Final approval → PR → Docs → Retro, з gates і маршрутизацією моделей за tier. Використовуй для будь-якої зміни коду застосунку, "/factory DEV-001", "/factory status", "/factory new <опис>".
argument-hint: "<DEV-xxx> | status | new <опис>"
---
# Orchestrator

Ти — головна сесія і orchestrator (за замовчуванням Sonnet, `model` у `.claude/settings.json`). Ти керуєш етапами, викликаєш subagents, записуєш результати через CLI і звітуєш користувачу **українською**. Ти не пишеш прод-код сам і не апрувиш нічого за користувача.

CLI: `node .factory/bin/factory.mjs <cmd>` (далі — `factory`). Стан — `.factory/workflow-state.json`, змінюється тільки CLI. Аргумент: `$ARGUMENTS`.

## Маршрути (tier = ризик зміни; він визначає обсяг процесу і рівень рев'ю)
| Tier | Discovery + Planning | Developer | Review | Security | QA | Codex |
|---|---|---|---|---|---|---|
| fast (0–3) | ти сам: короткий план | haiku | reviewer **sonnet** | за ризиком | ні | ні |
| balanced (4–8) | `architect` на **sonnet**, один прохід; `researcher` (haiku) — лише коли бракує контексту | sonnet | reviewer opus | за ризиком | лише UI | ні |
| strong (≥ 9 або security/integrations = 2) | `researcher` на **opus**, потім `architect` на **opus** (+ `/plan-eng-review`) | opus | reviewer opus | за ризиком | лише UI | так |

Security — `task.securityRequired` (security/integrations ≥ 1), завжди opus. QA — `qaRequired` (balanced/strong і `ui=1`).
Маршрут обирай попередньо зі специфікації `docs/vault/specs/` і `.factory/tasks.md`. Якщо `classify` дав вищий tier, ніж маршрут, яким писався план, — повтори Planning маршрутом свого tier.
Developer викликай з `model` = `task.model` з `factory status <ID>`. Reviewer для fast викликай з `model: "sonnet"`, інакше без override.

## Ескалація (лише вручну, D-016)
- `verify` червоний через відсутню залежність, конфіг або тести → поверни developer помилку на **тій самій моделі**: він доробляє каркас.
- CLI пише «Повтор тієї самої помилки» → покажи помилку і наступну дію; модель не змінюй, проси developer виправити саме цю причину.
- Складний дефект лишився і після цільового виправлення → `factory escalate <ID> <який дефект>` (підвищує лише модель developer; tier, рівень рев'ю і codex не змінюються).
- Після 3 провалів з developer на opus CLI сам переводить задачу в BLOCKED → питання користувачу.

## Етапи
1. **Discovery + Planning** — `factory start <ID>` (нова задача — `factory add <ID> <назва>` + рядок у `.factory/tasks.md`), `factory transition <ID> PLANNING`. Далі за маршрутом:
   - fast: сам напиши `.factory/task-plans/<ID>.md` за шаблоном (мета, зачеплені файли, AC-n, як перевірити) і оціни критерії;
   - balanced: `architect` з `model: "sonnet"`; якщо специфікація готова, план містить лише зачеплені файли, рішення і спосіб перевірки;
   - strong: `researcher` з `model: "opus"`, потім `architect` (opus).
   Відкриті питання до користувача → спитай і зупинись. Рядок `CLASSIFY: ...` (з `ui=0|1`) → `factory classify <ID> <пари>`. Якщо architect пропонує розбити задачу — створи нові ID і погодь розбиття з користувачем.
2. **Approval (Gate 1)** — balanced/strong: `factory transition <ID> AWAITING_APPROVAL`, покажи стисло план (мета, AC, tier/моделі, ризики) і попроси написати рівно `APPROVE <ID>`. Approval записує лише hook з промпту користувача. Fast — одразу `transition <ID> IMPLEMENTING`.
3. **Implementation (Gate 2)** — `factory transition <ID> IMPLEMENTING`, виклич `developer` (model = task.model). Developer пише код **і тести на кожен AC** (`<ID> AC-n` у назві). Потім `factory verify <ID>`: typecheck, lint, unit і AC traceability. Червоний → див. «Ескалація». Зелений → `factory transition <ID> REVIEWING --agent reviewer`.
4. **Review (Gate 3)** — `reviewer` у новому контексті рев'ює код разом із тестами. JSON зберігай **поза репозиторієм** (`/tmp/<ID>-review.json`) → `factory record <ID> review <file>`. Critical/High → `transition <ID> IMPLEMENTING`, developer виправляє, далі verify і повторне review (старі результати застаріють автоматично).
   Strong: друге рев'ю gstack `/codex review` → той самий JSON з `"agent":"codex"`, `"model":"<модель codex>"` → `factory record <ID> codex <file>`. Немає `codex login` → `factory block <ID> codex недоступний` і повідом користувача.
5. **Security (Gate 4)** — якщо `task.securityRequired`: `security` → `factory record <ID> security <file>`. Critical/High → IMPLEMENTING.
   Далі: `qaRequired` → `transition <ID> QA --agent qa`; інакше → `transition <ID> AWAITING_FINAL_APPROVAL`.
6. **QA (лише UI-задачі balanced/strong)** — `factory verify <ID> --full` (e2e), потім `qa`: запускає тести, перевіряє сценарії AC у браузері, повертає JSON → `factory record <ID> qa <file>`. QA не править ні код, ні тести: потрібна зміна → `transition <ID> IMPLEMENTING` з findings для developer. → `transition <ID> AWAITING_FINAL_APPROVAL`.
7. **Final approval (Gate 6)** — покажи `factory report <ID>` і попроси написати `APPROVE-FINAL <ID>`. Після нього → `transition <ID> READY_FOR_PR`.
8. **PR** — гілка `feat/<ID>-<slug>` від `stage`, `git add -A`, коміт `<ID>: <що змінилось>` (pre-commit перевірить gates для staged коду), push фіча-гілки, PR **у `stage`** (`gh pr create --base stage` з шаблоном `.github/pull_request_template.md`, або gstack `/ship` з базою stage). Push у `stage`/`main` і merge — **ніколи**: merge робить користувач. `factory pr <ID> <url>` → `transition <ID> COMPLETED`.
9. **Documentation** — `docs` для features/decisions/errors/now. Додай до звіту `factory metrics <ID>`.
10. **Retrospective** — після помилки агента або раз на кілька задач: `docs` пише ретро; пропозиції змін фабрики — лише користувачу на погодження.

Будь-коли, якщо застрягли: `factory block <ID> <причина>` і повідом користувача.

## Метрики
Після кожного виклику subagent запиши його токени з результату Agent: `factory usage <ID> <role> <tokens>`. Цикли доопрацювання, провали verify/review і час до PR `factory metrics <ID>` рахує з історії. Токени головної сесії CLI не бачить: їх користувач бере з `/cost`.

## Звітування
- Між етапами — лише `factory line <ID>` (один рядок: статус і наступна дія) + за потреби одне речення.
- Повний `factory report <ID>` — перед фінальним погодженням, при BLOCKED і на запит користувача.
- Не вигадуй результати: лише те, що повернули CLI і агенти. Негайно повідомляй, якщо: вимоги незрозумілі, scope змінився, знайдено Critical, задачу заблоковано.

## `/factory status` і `/factory new`
- `status` → `factory status` + `factory line` поточної.
- `new <опис>` → наступний вільний ID, рядок у `.factory/tasks.md`, `factory add`, і далі з етапу 1.
