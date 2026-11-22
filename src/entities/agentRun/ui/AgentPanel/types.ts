import type { ReactNode } from "react";

export type AgentPanelProps = {
  title: string;
  /** Іконка заголовка (lucide). */
  icon: ReactNode;
  /** Назва агента для тега, напр. «Агент A». */
  tagLabel: string;
  /** Демо-режим AI: тег «Демо · Агент A». */
  demo?: boolean;
  /** < 1024px панель згортається й показує `summary`. */
  collapsible?: boolean;
  /** Пульс рамки під час роботи агента. */
  running?: boolean;
  summary?: string;
  children: ReactNode;
};
