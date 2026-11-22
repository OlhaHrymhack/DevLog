import { Button } from "@/shared/ui/Button";
import { ResponsiveDialog } from "@/shared/ui/ResponsiveDialog";
import { optionStyles } from "./styles";

const SCREENS = [
  { value: "real", label: "Дані" },
  { value: "loading", label: "Завантаження" },
  { value: "empty", label: "Порожньо" },
  { value: "error", label: "Помилка" },
] as const;
const MODES = [
  { value: "auto", label: "За налаштуванням" },
  { value: "live", label: "Реальний API" },
  { value: "demo", label: "Демо без ключа" },
] as const;

export type ScreenOverride = typeof SCREENS[number]["value"];
export type ModeOverride = typeof MODES[number]["value"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screen: ScreenOverride;
  onScreenChange: (screen: ScreenOverride) => void;
  mode: ModeOverride;
  onModeChange: (mode: ModeOverride) => void;
  serious: boolean;
  onSeriousChange: (serious: boolean) => void;
  invalidOutput: boolean;
  onInvalidOutputChange: (value: boolean) => void;
};

export const DevStatesPanel = ({
  open, onOpenChange, screen, onScreenChange, mode, onModeChange,
  serious, onSeriousChange, invalidOutput, onInvalidOutputChange,
}: Props) => {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Стани прототипу"
      description="Перевірка відображення в режимі розробки."
      actions={<Button onClick={() => onOpenChange(false)}>Готово</Button>}
    >
      <div className="space-y-4">
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-medium">Дані екрана</legend>
          {SCREENS.map(({ value, label }) => (
            <label key={value} className={optionStyles}>
              <input type="radio" name="screen" checked={screen === value} onChange={() => onScreenChange(value)} /> {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-medium">Режим AI</legend>
          {MODES.map(({ value, label }) => (
            <label key={value} className={optionStyles}>
              <input type="radio" name="ai-mode" checked={mode === value} onChange={() => onModeChange(value)} /> {label}
            </label>
          ))}
        </fieldset>
        <label className={optionStyles}>
          <input type="checkbox" checked={invalidOutput} onChange={(event) => onInvalidOutputChange(event.currentTarget.checked)} />
          Зламати відповідь агента
        </label>
        <label className={optionStyles}>
          <input type="checkbox" checked={serious} onChange={(event) => onSeriousChange(event.currentTarget.checked)} />
          Серйозний режим
        </label>
        <p className="text-xs text-fg-dim">Клавіші: / пошук · N нова задача · Esc закрити вікно</p>
      </div>
    </ResponsiveDialog>
  );
};
