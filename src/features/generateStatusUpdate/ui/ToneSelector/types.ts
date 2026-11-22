import type { StatusUpdateRequestedTone, StatusUpdateTone } from "@/entities/agentRun";

export type ToneSelectorProps = {
  value: StatusUpdateRequestedTone;
  /** Тон, який агент обрав сам; показується на чіпі «Авто → …». */
  resolved?: StatusUpdateTone;
  /** Серйозний режим: чіпа «З гумором» немає. */
  serious: boolean;
  disabled?: boolean;
  onChange: (tone: StatusUpdateRequestedTone) => void;
};
