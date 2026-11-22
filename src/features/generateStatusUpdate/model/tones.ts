import type { StatusUpdateRequestedTone, StatusUpdateTone } from "@/entities/agentRun";

export const TONE_LABELS: Record<StatusUpdateRequestedTone, string> = {
  auto: "Авто",
  team: "Для команди",
  manager: "Для менеджера",
  short: "Коротко",
  humor: "З гумором",
};

/** Підпис чіпа «Авто»: після результату показує вибраний агентом тон. */
export const autoToneLabel = (resolved?: StatusUpdateTone): string =>
  resolved ? `${TONE_LABELS.auto} → ${TONE_LABELS[resolved].toLowerCase()}` : TONE_LABELS.auto;
