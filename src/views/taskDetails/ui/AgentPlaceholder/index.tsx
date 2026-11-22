import { EmptyState } from "@/shared/ui/EmptyState";
import type { AgentPlaceholderProps } from "./types";

export const AgentPlaceholder = ({ id, title }: AgentPlaceholderProps) => (
  <div id={id}>
    <EmptyState emoji="✨" title={title} description="З’явиться разом із AI-агентом цієї задачі." />
  </div>
);
