# DevLog — дизайн-система і карта компонентів

Джерело правди для UI. Живий прототип: `prototype.html` (відкрити в браузері; кнопка з колбою у шапці перемикає стани).
Токени: `tokens.css`. Стек: Next.js App Router + TypeScript strict, Tailwind CSS, shadcn/ui, lucide-react.

---

## 1. Принципи

1. **Монохром + один акцент для AI.** Інтерфейс чорно-білий. Фіолетовий (`--ai`) означає лише одне: тут працює агент.
2. **AI пропонує, людина вирішує.** Жоден агент не змінює дані без явної кнопки підтвердження. Кожен результат агента має кнопку «Застосувати/Створити» і «Скасувати».
3. **Агент показує, що думає.** Кожен запуск видно як список кроків зі станами `pending → run → done | fail`, а також прогрес-бар.
4. **Гумор лише у мікрокопі.** Його немає в помилках, у діалозі видалення і в апдейтах для менеджера. Вмикається перемикачем «Серйозний режим».
5. **Mobile-first, 375px мінімум.** Жодного горизонтального скролу сторінки.

---

## 2. Дизайн-токени

### 2.1 Кольори (dark — за замовчуванням / light)

| Токен | Dark | Light | Де використовується |
|---|---|---|---|
| `bg` | `#000000` | `#F7F7F8` | фон сторінки |
| `surface` | `#111111` | `#FFFFFF` | картки, модалки |
| `surface-sunken` | `#0A0A0A` | `#FAFAFA` | поля вводу, bubble |
| `surface-raised` | `#1A1A1A` | `#F0F0F2` | hover, tooltip |
| `border` | `rgba(255,255,255,.10)` | `#E4E4E7` | межі карток |
| `border-strong` | `rgba(255,255,255,.20)` | `#D4D4D8` | поля, ghost-кнопки |
| `text` | `#F1F1F1` | `#18181B` | основний текст |
| `text-strong` | `#FFFFFF` | `#000000` | заголовки, назви задач |
| `text-muted` | `#ABAFB5` | `#52525B` | описи |
| `text-dim` | `#8A8E94` | `#6B6B73` | підписи, мета |
| `primary` / `primary-fg` | `#FFFFFF` / `#000000` | `#000000` / `#FFFFFF` | головні кнопки |
| `ai` / `ai-bg` / `ai-border` | `#C4B5FD` / 10% / 35% | `#6D28D9` / `#F5F3FF` / `#DDD6FE` | усе, що стосується агентів |
| `status-todo` bg / fg | `rgba(255,255,255,.08)` / `#D4D4D8` | `#F4F4F5` / `#3F3F46` | бейдж «До роботи» |
| `status-progress` bg / fg / dot | 16% / `#93C5FD` / `#60A5FA` | `#DBEAFE` / `#1E40AF` / `#2563EB` | бейдж «В роботі» |
| `status-done` bg / fg | 13% / `#86EFAC` | `#DCFCE7` / `#166534` | бейдж «Готово» |
| `priority-high / medium / low` | `#FDBA74` / `#FCD34D` / `#ABAFB5` | `#C2410C` / `#A16207` / `#52525B` | пріоритет |
| `danger` | `#F87171` | `#DC2626` | видалення, помилки |
| `warning-*` | жовтий 8% | `#FFFBEB` / `#854D0E` | демо-режим |
| `heat` | `#FB923C` | `#EA580C` | світіння «Пожежної тривоги» |
| `focus` | `#C4B5FD` | `#6D28D9` | кільце фокусу |

Контраст перевірено: мінімальна пара тексту `text-dim` на `bg` у світлій темі дає 4.93:1, у темній `text-dim` на `surface` дає 5.73:1 (обидві ≥ WCAG AA 4.5:1).

### 2.2 Типографіка

Шрифти: **Inter** (400/500/600), **JetBrains Mono** (логотип, клавіші).

| Токен | Розмір | Вага | Використання |
|---|---|---|---|
| `text-3xl` | 40 (28 на мобілці) | 400, tracking −0.02em | заголовок сторінки «Задачі» |
| detail title | 34 (26 на мобілці) | 400 | назва задачі на сторінці деталей |
| `text-xl` | 22 | 500 | заголовок модалки, empty state |
| `text-lg` | 18 | 500 | заголовок картки / агента |
| `text-md` | 16 | 500 | кнопки великі, мобільні заголовки агента |
| `text-base` | 14 | 400/500 | основний текст, назви задач (500) |
| `text-sm` | 13 | 400 | описи, кроки агента |
| `text-xs` | 12 | 500, uppercase +0.06em | лейбли секцій, бейджі |

### 2.3 Відступи (крок 4px)

`space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 20 · `space-6` 24 · `space-8` 32 · `space-10` 40.
Контейнер: max 1376px, padding 32px (16px на мобілці). Внутрішній padding картки 20×22px.

### 2.4 Радіуси

`sm` 8 (чекбокси, скелетони) · `md` 12 (поля, чіпи, icon-кнопки) · `lg` 14 (кнопки, сегменти — як «Reach us» на holywater.tech) · `xl` 20 (картки) · `2xl` 24 (модалки, bottom sheet) · `full` (бейджі).

### 2.5 Рух

| Токен | Значення | Де |
|---|---|---|
| `ease-out` | `cubic-bezier(.2,.8,.2,1)` | усі появи |
| `dur-fast` | 150ms | hover, натискання (scale .97) |
| `dur-base` | 240ms | теми, перемикачі |
| `dur-slow` | 420ms | модалки, тости, поява списку |

Анімації: поява рядків каскадом (35ms на рядок) · кроки агента з «pop» галочкою · пульс рамки агента під час роботи · друк статус-апдейту посимвольно · мерехтіння 🔥 у «Палає» і «Пожежна тривога» · сирена-світіння у «Пожежна тривога» · bottom sheet знизу на мобілці. Усе вимикається через `prefers-reduced-motion`.

### 2.6 Tailwind

```ts
// tailwind.config.ts → theme.extend
colors: {
  bg: "var(--bg)", surface: { DEFAULT: "var(--surface)", sunken: "var(--surface-sunken)", raised: "var(--surface-raised)" },
  border: { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
  fg: { DEFAULT: "var(--text)", strong: "var(--text-strong)", muted: "var(--text-muted)", dim: "var(--text-dim)" },
  primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-fg)" },
  ai: { DEFAULT: "var(--ai)", bg: "var(--ai-bg)", border: "var(--ai-border)" },
  danger: "var(--danger)", heat: "var(--heat)", success: "var(--success)",
},
borderRadius: { sm: "8px", md: "12px", lg: "14px", xl: "20px", "2xl": "24px" },
fontFamily: { sans: ["var(--font-sans)"], mono: ["var(--font-mono)"] },
darkMode: ["class"],
```
shadcn/ui: прив'язати `--background`, `--foreground`, `--primary` тощо до токенів вище, щоб компоненти shadcn успадкували тему.

---

## 3. Адаптивність

| Брейкпоінт | Список задач | Агенти A і D | Деталі задачі | Модалки |
|---|---|---|---|---|
| ≥1024 (desktop) | таблиця: назва · статус · пріоритет · вік · 🌶️ · дії | права колонка 384px, sticky | 2 колонки: задача + агенти B/C (440px) | по центру, max 520 (легенда 760) |
| 768–1023 (tablet) | картки, 2 колонки | 2 згорнуті картки в ряд над списком | вкладки «Задача / Підзадачі / Апдейт» | по центру |
| <768 (mobile) | картки, 1 колонка; фільтр-сегмент гортається вбік; «Температура» тільки іконкою | згорнуті картки з підсумком, по тапу розгортаються | вкладки, sticky під шапкою | bottom sheet, кнопки дій sticky внизу |

FAB «+» лише на мобільному списку. Цілі натискання ≥ 44px.

---

## 4. Домен (entities)

```ts
type TaskStatus = "todo" | "in-progress" | "done";
type TaskPriority = "low" | "medium" | "high";
interface Task { id: string; title: string; description: string; status: TaskStatus; priority: TaskPriority;
  createdAt: string; updatedAt: string; dueAt?: string; subtasks: Subtask[]; notes: Note[]; }
interface Subtask { id: string; title: string; status: TaskStatus; source: "user" | "ai"; }
interface Note { id: string; text: string; createdAt: string; }
type AgentKind = "prioritize" | "decompose" | "status-update" | "stuck-radar";
type AgentRunStatus = "idle" | "running" | "clarify" | "result" | "fallback" | "applied";
interface AgentStep { label: string; state: "pending" | "run" | "done" | "fail"; detail?: string; }
interface AgentRun<R> { id: string; kind: AgentKind; status: AgentRunStatus; steps: AgentStep[]; result?: R; startedAt: string; finishedAt?: string; }
```
`dueAt` — розширення ТЗ, потрібне для рівня «Пожежна тривога». `updatedAt` змінюється при зміні статусу, підзадач і нотаток; від нього рахується «днів без змін».

### Температура задачі (`entities/task/model/getHeat.ts`)

| Рівень | Позначка | Умова | Розшифровка | Підпис |
|---|---|---|---|---|
| Свіжа | 🥒 | оновлювалась ≤ 2 дні | Усе гаразд, задача рухається | «Свіженька, хрумка, ще ніхто не встиг її зіпсувати» |
| Спокійна | 🧊 | пріоритет low | Не термінова, може почекати | «Лежить у морозилці. Нікому не заважає, нікого не чекає» |
| Готово | ✅ | status done | Закрито | «Здано. Можна забути з чистою совістю» |
| Тепленька | 🌶️ | medium/high, 3–4 дні без змін (medium зупиняється тут) | Починає застрягати | «Ще не горить. Просто тліє, як твоя мотивація в понеділок» |
| Гаряча | 🌶️🌶️ | high, 5–6 днів | Затримується й впливає на інших | «Задачу помітив навіть менеджер. Це погано» |
| Палає | 🌶️🌶️🌶️🔥 | high, 7+ днів | Зробити сьогодні або розбити | «Ця задача вже має стаж. Скоро попросить підвищення» |
| Пожежна тривога | 🏚️🔥🚒 | dueAt < 24 год, не done | Кинути все або перенести дедлайн | «Час удавати, що так і було задумано» |

У списку показуються лише 🌶️ і вище. Підказка з розшифровкою — при наведенні/фокусі. Повна легенда — кнопка «Температура».

---

## 5. Агенти: сценарії й стани

Усі агенти: `idle → running (кроки + прогрес + «Зупинити») → result | clarify | fallback → applied`.
Валідація output: zod-схема + перевірка, що всі згадані id існують. Якщо валідація не пройшла двічі, агент повертає **fallback**: детерміноване правило без AI із червоним alert і поясненням.

| Агент | Кроки | Рішення по ходу | Підтвердження |
|---|---|---|---|
| **A. План на день** | зібрати активні → зважити (пріоритет, вік, днів без змін, in-progress, дедлайн) → порядок + пояснення → валідація | пояснення й жарт залежать від температури; top-3 + «Відкладено» | «Застосувати порядок» → діалог → позначка «Фокус #N» (статуси не змінюються) |
| **B. Декомпозиція** | прочитати задачу → оцінити чіткість → згенерувати → валідація (3–6 пунктів, без дублів) | нечітка (опис < 40 символів або «щось/якось/покращити») → **clarify**: питання + поле відповіді; відповідь зберігається нотаткою | чекбокси по кожній підзадачі + «Створити N підзадач» |
| **C. Статус-апдейт** | зібрати задачу/підзадачі/нотатки → визначити тон → чернетка → перевірка фактів | Авто-тон: ризик/дедлайн/гаряча → «Для менеджера», інакше «Для команди»; мало даних → підказка додати нотатку | агент нічого не надсилає: «Скопіювати» |
| **D. Радар застряглих** | знайти in-progress ≥3 днів без змін → зіставити з нотатками й підзадачами → причина → дія | «Чекає на ревʼю» (є PR у нотатці) → чернетка запиту; «Задача розмита» (0 підзадач і нотаток) → перехід у B з автозапуском; «Завелика» (≥3 відкритих) → чернетка прохання про допомогу | кожна дія — окрема кнопка; «Ігнорувати» ховає до наступного сканування |

### Матриця станів екранів

| Екран | loading | empty | error | демо-режим AI |
|---|---|---|---|---|
| Список | скелетон рядків | «Нічого не горить 🧘» + CTA; окремо «немає за фільтром» + «Скинути» | 🔌 «Не вдалося завантажити» + «Спробувати ще раз» | жовтий банер під шапкою |
| Деталі | скелетон заголовка й опису | «Задачу не знайдено» | 🔌 + retry | бейдж «Демо · Агент X» |
| Агенти | прогрес + кроки + скелетон | «Немає задач для аналізу» | fallback з alert | бейдж «Демо», підпис «мок-відповідь» |
| Форма | — | — | валідація полів: червона рамка + текст під полем, фокус на першу помилку | — |

---

## 6. Карта компонентів за FSD

Правила: імпорти лише вниз (`views → widgets → features → entities → shared`), кожен slice експортує через `index.ts`. Компонент — папка в PascalCase: `index.tsx` (function declaration + named export), `types.ts` (props), `styles.ts` (cva). Порожні файли не створюємо. Бізнес-логіки в компонентах немає: вона в `model/`.

```
src/
├─ app/                              # Next.js App Router (лише тут export default)
│  ├─ layout.tsx · page.tsx · tasks/[id]/page.tsx
│  └─ api/tasks/… · api/agents/{prioritize,decompose,status-update,stuck-radar}/route.ts
├─ views/
│  ├─ tasks-list/ui/TasksListView/
│  └─ task-details/ui/TaskDetailsView/
├─ widgets/
│  ├─ app-header/ui/AppHeader/              # лого, ThemeToggle, NewTaskButton
│  ├─ demo-mode-banner/ui/DemoModeBanner/
│  ├─ task-list/ui/TaskList/ · TaskListToolbar/ · TaskListEmpty/ · TaskListError/ · TaskListSkeleton/
│  ├─ day-plan-panel/ui/DayPlanPanel/       # Агент A
│  ├─ stuck-radar-panel/ui/StuckRadarPanel/ # Агент D
│  ├─ decompose-panel/ui/DecomposePanel/    # Агент B
│  ├─ status-update-panel/ui/StatusUpdatePanel/ # Агент C
│  ├─ task-overview/ui/TaskOverview/        # заголовок, мета, опис
│  ├─ subtask-list/ui/SubtaskList/
│  └─ note-list/ui/NoteList/
├─ features/
│  ├─ task-create/ui/CreateTaskDialog/   · model/useCreateTask.ts
│  ├─ task-edit/ui/EditTaskDialog/        · model/useUpdateTask.ts
│  ├─ task-delete/ui/DeleteTaskDialog/    · model/useDeleteTask.ts
│  ├─ task-form/ui/TaskForm/              · model/taskFormSchema.ts (zod)
│  ├─ task-filter/ui/StatusFilter/        · model/useTaskFilter.ts
│  ├─ task-sort/ui/SortSelect/            · model/sortTasks.ts
│  ├─ task-search/ui/TaskSearch/
│  ├─ task-status-change/ui/StatusSelect/ · PrioritySelect/
│  ├─ subtask-toggle/ui/SubtaskCheckbox/
│  ├─ note-add/ui/AddNoteForm/
│  ├─ prioritize-tasks/ui/DayPlanResult/ · ApplyFocusDialog/ · model/{prioritizeAgent.ts, scoreTask.ts, rulePlan.ts}
│  ├─ decompose-task/ui/ClarifyForm/ · SubtaskProposalList/ · model/{decomposeAgent.ts, isVague.ts}
│  ├─ generate-status-update/ui/ToneSelector/ · SlackPreview/ · model/{statusUpdateAgent.ts, pickTone.ts}
│  ├─ detect-stuck-tasks/ui/StuckTaskCard/ · DraftMessageDialog/ · model/{stuckRadarAgent.ts, diagnose.ts}
│  ├─ heat-legend/ui/HeatLegendDialog/
│  └─ theme-toggle/ui/ThemeToggle/
├─ entities/
│  ├─ task/   ui/{TaskRow, TaskCard, StatusBadge, PriorityLabel, HeatBadge}/ · model/{types.ts, getHeat.ts, heatLevels.ts, taskStore.ts} · api/taskApi.ts
│  ├─ note/   ui/NoteItem/ · model/types.ts
│  └─ agent-run/ ui/{AgentPanel, AgentStepList, AgentProgress, AgentFallbackAlert, AgentTag}/ · model/{types.ts, runSteps.ts, validateOutput.ts}
└─ shared/
   ├─ ui/      # shadcn: button, badge, card, dialog, sheet, input, textarea, select, checkbox, switch,
   │           # tabs, tooltip, toggle-group, skeleton, progress, alert, sonner(toast) + EmptyState/
   ├─ lib/     # cn.ts, plural.ts (uk), formatDate.ts, daysBetween.ts, copyToClipboard.ts
   └─ config/  # env.ts (ANTHROPIC_API_KEY → aiMode), routes.ts, copy.uk.ts (тексти й жарти)
```

### Ключові компоненти і варіанти (cva)

| Компонент | Шар | Варіанти |
|---|---|---|
| `Button` | shared/ui | `variant`: primary · ghost · danger · danger-ghost · ai; `size`: sm · md · icon |
| `StatusBadge` | entities/task | `status`: todo · in-progress (пульс точки) · done |
| `PriorityLabel` | entities/task | `priority`: high (ChevronsUp) · medium (Minus) · low (ChevronDown) |
| `HeatBadge` | entities/task | `level`: warm · hot · fire (мерехтіння) · alarm (сирена); tooltip з розшифровкою |
| `TaskRow` / `TaskCard` | entities/task | один компонент, вигляд від брейкпоінта; `focusRank?` |
| `AgentPanel` | entities/agent-run | `collapsible` (мобілка/планшет), `running` (пульс рамки), `demo` |
| `AgentStepList` | entities/agent-run | крок: pending · run · done · fail |
| `EmptyState` | shared/ui | `tone`: neutral · humor · error |

Іконки lucide-react: `Plus, Search, Sun, Moon, FlaskConical, Target, Radar, ListTree, MessageSquare, Sparkles, Pencil, Trash2, Check, X, Copy, RefreshCw, Square, AlertTriangle, Info, HelpCircle, ChevronDown, ChevronLeft, ChevronsUp, Minus, WifiOff, FileText, StickyNote`.

---

## 7. Доступність

- Контраст AA для всього тексту (див. 2.1); кольори статусів розрізняються і світлотою, і іконкою, не лише відтінком.
- `:focus-visible` — кільце 2px `--focus` на всьому інтерактивному; рядок списку підсвічується при фокусі на посиланні.
- Клавіатура: `/` пошук · `N` нова задача · `Esc` закрити · Tab-пастка в діалогах · фокус повертається на кнопку, що відкрила діалог.
- `aria-live="polite"` на кроках агента і тостах; `role="alert"` на помилках; `aria-pressed` на фільтрах і чіпах тону; `role="tablist"` на мобільних вкладках; `aria-label` на кнопках-іконках.

---

## 8. Промпт для старту в Claude Code

> Прочитай `design/DESIGN.md`, підключи `design/tokens.css`, відкрий `design/prototype.html` як референс поведінки. Зроби scaffold UI DevLog за FSD зі структури §6: спочатку shared/ui (shadcn з нашими токенами) і entities/task, потім список задач з фільтром і сортуванням. Дотримуйся правил: function declaration + named export, папка на компонент з types.ts і styles.ts (cva), без бізнес-логіки в компонентах, без нових кольорів поза токенами. Мобілка від 375px.
