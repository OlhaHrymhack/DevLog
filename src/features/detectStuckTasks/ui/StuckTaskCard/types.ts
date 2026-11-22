import type { StuckAction, TriageItem } from "@/entities/agentRun";
import type { HeatKey } from "@/entities/task";

export type StuckTaskCardProps = {
  item: TriageItem;
  title: string;
  staleDays: number;
  heat: HeatKey;
  serious: boolean;
  onAct: (action: StuckAction, item: TriageItem) => void;
  onSnooze: (taskId: string) => void;
};
