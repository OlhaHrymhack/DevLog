import { cva } from "class-variance-authority";

export const TASK_TABLE_COLUMNS =
  "lg:grid-cols-[minmax(0,1fr)_104px_80px_52px_68px_76px] xl:grid-cols-[minmax(0,1fr)_120px_108px_80px_96px_88px]";

// Фон — у варіанті alarm (взаємовиключні класи: два bg-* на одному елементі конфліктують за порядком CSS).
// < 1024px — картка (areas: title/heat · meta · age/actions); ≥ 1024px — рядок таблиці з 6 колонками (прототип 139–164).
export const taskRowStyles = cva(
  [
    "relative grid animate-fade-up grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-border p-4",
    "[grid-template-areas:'title_heat''meta_meta''age_actions'] transition-colors duration-[var(--dur-fast)]",
    "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-focus",
    TASK_TABLE_COLUMNS,
    "lg:gap-3 lg:rounded-none lg:border-0 lg:border-b lg:px-5 lg:py-3.5 lg:[grid-template-areas:none]",
    "lg:last:border-b-0",
  ],
  {
    variants: {
      alarm: { true: "bg-heat/7", false: "bg-surface lg:bg-transparent lg:hover:bg-surface-raised/60" },
    },
  },
);

export const titleCellStyles = "min-w-0 wrap-anywhere [grid-area:title] lg:[grid-area:auto]";
export const heatCellStyles = "relative z-10 self-start [grid-area:heat] lg:self-center lg:[grid-area:auto]";
export const metaCellStyles = "flex flex-wrap items-center gap-3 [grid-area:meta] lg:contents";
export const ageCellStyles = "text-sm [grid-area:age] lg:[grid-area:auto]";
export const actionsCellStyles = "relative z-10 flex justify-end gap-0.5 [grid-area:actions] lg:[grid-area:auto]";

export const linkStyles = cva(
  "font-medium text-fg-strong no-underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none",
  {
    variants: {
      done: { true: "text-fg-dim line-through", false: "" },
    },
  },
);

export const descriptionStyles = "mt-[3px] line-clamp-2 text-sm text-fg-dim lg:truncate";
export const focusPinStyles =
  "ml-2 inline-flex items-center gap-1 rounded-full border border-ai-border px-2 py-px align-[2px] text-[11px] font-semibold text-ai";
