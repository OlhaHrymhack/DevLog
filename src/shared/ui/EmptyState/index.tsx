import { cn } from "@/shared/lib/cn";
import { descriptionStyles, emojiStyles, emptyStateStyles, titleStyles } from "./styles";
import type { EmptyStateProps } from "./types";

export const EmptyState = ({ tone = "neutral", emoji, title, description, action, className }: EmptyStateProps) => {
  return (
    <div role={tone === "error" ? "alert" : undefined} data-tone={tone} className={cn(emptyStateStyles(), className)}>
      <div aria-hidden="true" className={emojiStyles({ tone })}>
        {emoji}
      </div>
      <h3 className={titleStyles}>{title}</h3>
      {description ? <p className={descriptionStyles}>{description}</p> : null}
      {action}
    </div>
  );
};
