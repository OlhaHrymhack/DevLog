import { cva } from "class-variance-authority";

export const heatButtonStyles = cva(
  "relative inline-flex h-[44px] min-w-[44px] lg:h-9 cursor-help items-center justify-center rounded-md bg-transparent px-1.5 text-[15px] tracking-[-2px] whitespace-nowrap hover:bg-surface-raised focus-visible:bg-surface-raised",
  {
    variants: {
      siren: { true: "animate-siren", false: "" },
    },
  },
);

export const emojiStyles = cva("inline-block", {
  variants: { animated: { true: "animate-flicker", false: "" } },
});

export const tooltipStyles =
  "w-[260px] rounded-md border border-border-strong bg-surface-raised px-3.5 py-3 text-sm leading-normal tracking-normal text-fg shadow-lg [&>svg]:hidden";
export const tooltipTitleStyles = "mb-0.5 block text-fg-strong";
export const tooltipJokeStyles = "mt-1.5 block text-fg-muted italic";
