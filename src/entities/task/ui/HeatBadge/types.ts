import type { HeatLevel } from "../../model/heatLevels";

export type HeatBadgeProps = {
  level: HeatLevel;
  /** Серйозний режим: tooltip без жарту. */
  serious?: boolean;
  /** Показувати й рівні з `show: false` (легенда, /ui-kit). */
  always?: boolean;
};
