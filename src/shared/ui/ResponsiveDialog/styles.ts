import { cva } from "class-variance-authority";

export const dialogContentStyles = cva(
  "flex max-h-[calc(100dvh-32px)] w-full flex-col gap-[18px] overflow-auto rounded-2xl border-border-strong bg-surface p-[26px] shadow-lg",
  {
    variants: {
      wide: { true: "sm:max-w-[760px]", false: "sm:max-w-[520px]" },
    },
    defaultVariants: { wide: false },
  },
);

export const sheetContentStyles =
  "flex max-h-[92dvh] flex-col gap-[18px] overflow-auto rounded-t-2xl border-border-strong bg-surface px-[18px] pt-[22px] pb-[calc(18px+env(safe-area-inset-bottom))]";

export const titleStyles = "text-xl font-medium text-fg-strong";
export const descriptionStyles = "text-fg-muted";
export const dialogActionsStyles = "flex flex-wrap justify-end gap-2.5";
export const sheetActionsStyles = "sticky -bottom-[18px] -mb-1 flex gap-2.5 bg-surface pt-3 [&>*]:flex-1";
