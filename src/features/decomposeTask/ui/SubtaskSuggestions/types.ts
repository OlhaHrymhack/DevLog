import type { DecompositionItem } from "@/entities/agentRun";

export type SubtaskSuggestionsProps = {
  items: readonly DecompositionItem[];
  pending: boolean;
  onCreate: (selected: DecompositionItem[]) => void;
  onCancel: () => void;
};
