import { cva } from "class-variance-authority";

export const emptyStateStyles = cva("flex flex-col items-center gap-3 px-6 py-14 text-center");

export const emojiStyles = cva("text-[40px] leading-none", {
  variants: {
    tone: { neutral: "", humor: "animate-float", error: "" },
  },
  defaultVariants: { tone: "neutral" },
});

export const titleStyles = "m-0 text-xl font-medium text-fg-strong";
export const descriptionStyles = "m-0 max-w-[340px] leading-normal text-fg-muted";
