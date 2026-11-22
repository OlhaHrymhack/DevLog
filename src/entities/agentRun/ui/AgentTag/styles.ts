import { cva } from "class-variance-authority";

export const agentTagStyles = cva("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-xs whitespace-nowrap", {
  variants: {
    demo: {
      true: "border-warning-border bg-warning-bg text-warning-text",
      false: "border-ai-border text-ai",
    },
  },
  defaultVariants: { demo: false },
});
