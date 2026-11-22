import { cva } from "class-variance-authority";

export const cardStyles = "flex flex-col gap-2 rounded-lg border border-border bg-surface p-3";
export const topStyles = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1";
export const linkStyles = "min-w-0 break-words text-sm font-medium text-fg-strong underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
export const staleStyles = cva("shrink-0 text-xs", {
  variants: { hot: { true: "text-danger-text", false: "text-fg-muted" } },
  defaultVariants: { hot: false },
});
export const whyStyles = "m-0 text-sm leading-normal text-fg-muted";
export const causeStyles = "font-medium text-fg";
export const jokeStyles = "m-0 text-sm text-ai";
export const actionsStyles = "flex flex-wrap items-center gap-2";
