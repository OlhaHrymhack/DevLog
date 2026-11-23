import { cva } from "class-variance-authority";

export const statusBadgeStyles = cva(
  "inline-flex items-center gap-1.5 justify-self-start rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      status: {
        todo: "bg-status-todo-bg text-status-todo-fg",
        "in-progress": "bg-status-progress-bg text-status-progress-fg",
        done: "bg-status-done-bg text-status-done-fg",
      },
    },
  },
);

export const dotStyles = cva("size-1.5 rounded-full", {
  variants: {
    status: {
      todo: "border-[1.5px] border-current",
      "in-progress": "animate-pulse-dot bg-status-progress-dot",
      done: "",
    },
  },
});
