import { cva } from "class-variance-authority";

export const stepListStyles = "m-0 flex list-none flex-col gap-[9px] p-0 text-sm";

export const stepStyles = cva("flex animate-fade-up items-start gap-2.5", {
  variants: {
    state: {
      pending: "text-fg-dim",
      run: "text-fg-strong",
      done: "text-fg-muted",
      fail: "text-danger",
    },
  },
});

export const stepIconSlotStyles = "mt-px flex size-4 flex-none items-center justify-center";
export const spinnerStyles = "size-3.5 animate-spin rounded-full border-2 border-border-strong border-t-ai";
export const pendingStyles = "size-3 rounded-full border-[1.5px] border-dashed border-border-strong";
export const detailStyles = "mt-px block text-xs text-fg-dim";
