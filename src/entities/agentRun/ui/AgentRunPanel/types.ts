import type { ReactNode } from "react";
import type { AgentRunState } from "../../model/agentRunState";

export type AgentRunPanelProps = {
  title: string;
  icon: ReactNode;
  /** Назва агента для тега, напр. «Агент A». */
  tagLabel: string;
  run: AgentRunState;
  onStop: () => void;
  /** Режим AI до першої події `run` (з /api/health); далі — режим із події. */
  demo?: boolean;
  collapsible?: boolean;
  summary?: string;
  /** Вміст у стані `idle` (кнопка запуску). */
  idle?: ReactNode;
  /** Вміст після завершення: результат, дії «Застосувати» / «Відхилити». */
  children?: ReactNode;
};
