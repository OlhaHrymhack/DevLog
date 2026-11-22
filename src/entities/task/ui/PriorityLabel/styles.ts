import { cva } from "class-variance-authority";

export const priorityLabelStyles = cva("inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap", {
  variants: {
    priority: {
      high: "text-priority-high",
      medium: "text-priority-medium",
      low: "text-priority-low",
    },
  },
});
