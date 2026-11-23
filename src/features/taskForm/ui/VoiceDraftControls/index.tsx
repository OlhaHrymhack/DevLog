import { Mic, Square } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import type { useVoiceTaskDraft } from "../../model/useVoiceTaskDraft";
import { errorStyles, guideStyles, panelStyles, statusStyles } from "./styles";

type VoiceDraftControlsProps = ReturnType<typeof useVoiceTaskDraft> & {
  id: string;
  mode?: "demo" | "live";
  disabled: boolean;
};

export const VoiceDraftControls = ({ id, mode, disabled, phase, message, error, begin, cancel, stop }: VoiceDraftControlsProps) => {
  const recording = phase === "recording";
  const Icon = recording ? Square : Mic;
  const requesting = phase === "requesting";
  const idleText = mode === "demo" ? "Спробувати приклад" : "Продиктувати задачу";
  const buttonText = requesting ? "Скасувати запит" : recording ? "Зупинити запис" : idleText;
  const onClick = requesting ? cancel : recording ? stop : () => void begin(mode === "demo");

  return (
    <section className={panelStyles} aria-label="Голосове введення">
      <Button variant="ai" size="sm" className="w-fit"
        aria-describedby={id}
        disabled={disabled || !mode || phase === "processing"}
        onClick={onClick}
      >
        <Icon aria-hidden="true" className="size-4" />
        {buttonText}
      </Button>
      <div id={id} className={guideStyles}>
        <p>Скажіть, що зробити, і додайте контекст. За потреби назвіть пріоритет і дедлайн.</p>
        <p className="text-fg-strong">«Виправити зникнення аватара після оновлення профілю. Це терміново. Зробити до завтра, до 17:00».</p>
        <p>«Терміново» → високий, «може зачекати» → низький. Типовий пріоритет — середній. Для дедлайну назвіть день і час.</p>
      </div>
      <div role="status" className={statusStyles}>
        {phase === "requesting" && "Очікуємо доступ до мікрофона…"}
        {phase === "recording" && "Йде запис · до 60 секунд"}
        {phase === "processing" && "Готуємо чернетку…"}
        {message}
      </div>
      {error && <p role="alert" className={errorStyles}>{error}</p>}
    </section>
  );
};
