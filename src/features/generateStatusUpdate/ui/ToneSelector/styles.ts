import { cva } from "class-variance-authority";

export const groupStyles = "flex flex-wrap gap-1.5";
export const chipStyles = cva(
  "inline-flex min-h-9 items-center rounded-full border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      active: {
        true: "border-ai-border bg-ai-bg font-medium text-ai",
        false: "border-border bg-transparent text-fg-muted hover:text-fg",
      },
    },
    defaultVariants: { active: false },
  },
);
