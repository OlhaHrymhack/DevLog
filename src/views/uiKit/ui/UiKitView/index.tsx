"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Radar, Target } from "lucide-react";
import {
  AgentFallbackAlert,
  AgentPanel,
  AgentProgress,
  AgentStepList,
  AgentTag,
  type AgentStep,
} from "@/entities/agentRun";
import {
  HEAT_LEVELS,
  HEAT_ORDER,
  HeatBadge,
  PriorityLabel,
  StatusBadge,
  TaskRow,
  type TaskPriority,
  type TaskStatus,
} from "@/entities/task";
import { ThemeToggle } from "@/features/themeToggle";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ResponsiveDialog } from "@/shared/ui/ResponsiveDialog";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/Alert";
import { Checkbox } from "@/shared/ui/Checkbox";
import { Input } from "@/shared/ui/Input";
import { Progress } from "@/shared/ui/Progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/Select";
import { Skeleton } from "@/shared/ui/Skeleton";
import { Switch } from "@/shared/ui/Switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { Textarea } from "@/shared/ui/Textarea";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/ToggleGroup";
import { SAMPLE_TASKS, UI_KIT_NOW } from "../../model/sampleTasks";
import { AgentRunDemo } from "../AgentRunDemo";
import { pageStyles, rowStyles, sectionTitleStyles, tableStyles } from "./styles";

const STATUSES: readonly TaskStatus[] = ["todo", "in-progress", "done"];
const PRIORITIES: readonly TaskPriority[] = ["high", "medium", "low"];

const RUNNING_STEPS: readonly AgentStep[] = [
  { label: "Зібрати активні задачі", state: "done", detail: "Знайдено 9 активних" },
  { label: "Зважити пріоритет, вік і дедлайн", state: "run" },
  { label: "Сформувати порядок і пояснення", state: "pending" },
  { label: "Перевірити результат", state: "pending" },
];

const FAILED_STEPS: readonly AgentStep[] = [
  { label: "Зібрати активні задачі", state: "done" },
  { label: "Згенерувати підзадачі", state: "done" },
  { label: "Перевірити результат", state: "fail", detail: "Відповідь не пройшла валідацію двічі" },
];

const Section = ({ title, children }: { title: string; children: ReactNode }) => {
  const id = `ui-kit-${title}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className={sectionTitleStyles}>
        {title}
      </h2>
      {children}
    </section>
  );
};

const noop = () => {};

export const UiKitView = () => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main className={pageStyles}>
      <header className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-2xl font-normal tracking-[-0.02em] text-fg-strong md:text-3xl">UI Kit</h1>
        <ThemeToggle />
      </header>

      <Section title="Button">
        <div className={rowStyles}>
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="danger-ghost">Danger ghost</Button>
          <Button variant="ai">AI</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className={rowStyles}>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="ghost" size="sm">
            Small ghost
          </Button>
          <Button variant="ghost" size="icon" aria-label="Редагувати">
            <Pencil aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className={rowStyles}>
          {STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
        <div className={rowStyles}>
          {PRIORITIES.map((priority) => (
            <PriorityLabel key={priority} priority={priority} />
          ))}
        </div>
        <div className={rowStyles}>
          <AgentTag label="Агент A" />
          <AgentTag label="Агент A" demo />
        </div>
      </Section>

      <Section title="Heat">
        <div className={rowStyles}>
          {HEAT_ORDER.map((key) => (
            <div key={key} className="flex items-center gap-1.5 text-sm text-fg-muted">
              <HeatBadge level={HEAT_LEVELS[key]} always />
              {HEAT_LEVELS[key].name}
            </div>
          ))}
        </div>
      </Section>

      <Section title="TaskRow">
        <div className={tableStyles}>
          {SAMPLE_TASKS.map((task, index) => (
            <TaskRow key={task.id} task={task} now={UI_KIT_NOW} focusRank={index === 4 ? 1 : undefined} onEdit={noop} onDelete={noop} />
          ))}
        </div>
      </Section>

      <Section title="Agent">
        <div className="grid gap-4 lg:grid-cols-2">
          <AgentPanel title="План на день" icon={<Target aria-hidden="true" className="size-4" />} tagLabel="Агент A" running>
            <AgentProgress steps={RUNNING_STEPS} />
            <AgentStepList steps={RUNNING_STEPS} />
          </AgentPanel>
          <AgentPanel
            title="Радар застряглих"
            icon={<Radar aria-hidden="true" className="size-4" />}
            tagLabel="Агент D"
            demo
            collapsible
            summary="3 задачі застрягли понад 3 дні"
          >
            <AgentStepList steps={FAILED_STEPS} />
            <AgentFallbackAlert title="Агент не зміг відповісти">Показуємо базове правило без AI.</AgentFallbackAlert>
          </AgentPanel>
          <AgentRunDemo />
        </div>
      </Section>

      <Section title="EmptyState">
        <div className="grid gap-4 lg:grid-cols-3">
          <EmptyState tone="humor" emoji="🧘" title="Нічого не горить" description="Усі задачі під контролем. Можна видихнути." />
          <EmptyState tone="neutral" emoji="🔍" title="Нічого не знайдено" description="Спробуйте змінити фільтр або пошуковий запит." action={<Button variant="ghost" size="sm">Скинути</Button>} />
          <EmptyState tone="error" emoji="🔌" title="Не вдалося завантажити" description="Перевірте з'єднання й спробуйте ще раз." action={<Button variant="primary" size="sm">Спробувати ще раз</Button>} />
        </div>
      </Section>

      <Section title="Dialog">
        <div className={rowStyles}>
          <Button variant="ghost" onClick={() => setDialogOpen(true)}>
            Відкрити діалог
          </Button>
        </div>
        <ResponsiveDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Видалити задачу?"
          description="Діалог по центру від 768px, нижня панель — на мобільному."
          actions={
            <>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Скасувати
              </Button>
              <Button variant="danger" onClick={() => setDialogOpen(false)}>
                Видалити
              </Button>
            </>
          }
        >
          <p className="m-0 text-fg-muted">Усі підзадачі й нотатки буде видалено без можливості відновлення.</p>
        </ResponsiveDialog>
      </Section>

      <Section title="Forms">
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Назва задачі" aria-label="Назва задачі" />
          <Select defaultValue="medium">
            <SelectTrigger aria-label="Пріоритет" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">Високий</SelectItem>
              <SelectItem value="medium">Середній</SelectItem>
              <SelectItem value="low">Низький</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Опис" aria-label="Опис" className="md:col-span-2" />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox /> Підзадача виконана
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch /> Серйозний режим
          </label>
          <ToggleGroup type="single" defaultValue="all" variant="outline" aria-label="Фільтр статусу">
            <ToggleGroupItem value="all">Усі</ToggleGroupItem>
            <ToggleGroupItem value="todo">До роботи</ToggleGroupItem>
            <ToggleGroupItem value="done">Готово</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </Section>

      <Section title="Feedback">
        <Tabs defaultValue="task">
          <TabsList>
            <TabsTrigger value="task">Задача</TabsTrigger>
            <TabsTrigger value="subtasks">Підзадачі</TabsTrigger>
          </TabsList>
          <TabsContent value="task" className="text-sm text-fg-muted">
            Вміст вкладки «Задача».
          </TabsContent>
          <TabsContent value="subtasks" className="text-sm text-fg-muted">
            Вміст вкладки «Підзадачі».
          </TabsContent>
        </Tabs>
        <Progress value={60} aria-label="Приклад прогресу" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-[70%]" />
          <Skeleton className="h-3 w-[92%]" />
          <Skeleton className="h-3 w-[55%]" />
        </div>
        <Alert>
          <AlertTitle>Демо-режим</AlertTitle>
          <AlertDescription>Агенти відповідають мок-даними без API-ключа.</AlertDescription>
        </Alert>
      </Section>
    </main>
  );
};
