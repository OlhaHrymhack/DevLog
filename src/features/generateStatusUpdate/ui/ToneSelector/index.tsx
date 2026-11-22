import { STATUS_UPDATE_REQUESTED_TONES } from "@/entities/agentRun";
import { autoToneLabel, TONE_LABELS } from "../../model/tones";
import { chipStyles, groupStyles } from "./styles";
import type { ToneSelectorProps } from "./types";

/** Чіпи тону з `aria-pressed`; у серйозному режимі «З гумором» прихований. */
export const ToneSelector = ({ value, resolved, serious, disabled = false, onChange }: ToneSelectorProps) => (
  <div role="group" aria-label="Тон апдейту" className={groupStyles}>
    {STATUS_UPDATE_REQUESTED_TONES.filter((tone) => !(serious && tone === "humor")).map((tone) => (
      <button key={tone} type="button" aria-pressed={value === tone} disabled={disabled}
        className={chipStyles({ active: value === tone })} onClick={() => onChange(tone)}
      >
        {tone === "auto" ? autoToneLabel(value === "auto" ? resolved : undefined) : TONE_LABELS[tone]}
      </button>
    ))}
  </div>
);
