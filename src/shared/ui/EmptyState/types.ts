import type { ReactNode } from "react";

export type EmptyStateTone = "neutral" | "humor" | "error";

export type EmptyStateProps = {
  /** neutral — без анімації; humor — емодзі «пливе»; error — `role="alert"`. */
  tone?: EmptyStateTone;
  emoji: string;
  title: string;
  description?: string;
  /** Дія (кнопка), напр. «Спробувати ще раз». */
  action?: ReactNode;
  className?: string;
};
