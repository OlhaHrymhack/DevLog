import { cva } from "class-variance-authority";

export const panelStyles = cva("group overflow-hidden rounded-xl border bg-surface transition-colors duration-[var(--dur-base)]", {
  variants: {
    running: { true: "animate-breathe border-ai-border", false: "border-border" },
  },
});

export const headStyles =
  "flex w-full items-center justify-between gap-2.5 border-b border-border bg-transparent px-5 py-4 text-left text-inherit max-md:px-4 max-md:py-3 group-data-[open=false]:max-lg:border-b-0";
export const titleStyles = "m-0 flex items-center gap-2 text-lg font-medium text-fg-strong max-md:text-md";
export const tagStyles = "group-data-[open=false]:max-md:hidden";
export const summaryStyles = "hidden px-5 pb-3.5 text-sm text-fg-muted max-md:px-4 max-md:pb-3 max-md:text-xs group-data-[open=false]:max-lg:block";
export const bodyStyles = "flex flex-col gap-3.5 px-5 py-4 max-md:px-4 group-data-[open=false]:max-lg:hidden";
