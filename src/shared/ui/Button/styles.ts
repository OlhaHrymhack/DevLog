import { cva } from "class-variance-authority";

export const buttonStyles = cva(
  "inline-flex min-h-[44px] md:min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent px-[18px] font-medium whitespace-nowrap transition-[transform,background-color,border-color,opacity] duration-[var(--dur-fast)] ease-out active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground enabled:hover:bg-primary-hover",
        ghost: "border-border-strong bg-transparent text-fg enabled:hover:bg-surface-raised",
        danger: "bg-danger text-danger-fg",
        "danger-ghost": "border-danger-border bg-transparent text-danger",
        ai: "border-ai-border bg-ai-bg text-ai enabled:hover:border-ai",
      },
      size: {
        sm: "min-h-[44px] rounded-md md:min-h-[34px] px-3.5 text-sm",
        md: "",
        icon: "w-[44px] px-0 md:w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
