import { HEAT_LEVELS, HEAT_ORDER } from "@/entities/task";
import { Button } from "@/shared/ui/Button";
import { ResponsiveDialog } from "@/shared/ui/ResponsiveDialog";
import type { HeatLegendDialogProps } from "./types";
import { tableStyles, columnTitleStyles, levelRowStyles, levelTitleStyles, ruleStyles, signatureStyles } from "./styles";

export const HeatLegendDialog = ({ open, onOpenChange, serious }: HeatLegendDialogProps) => (
  <ResponsiveDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Температура задач"
    description="Рахується за пріоритетом, днями без змін (статус, підзадачі, нотатки) і дедлайном. У списку показуються лише 🌶️ і вище, щоб погляд чіплявся за проблеми."
    wide
    actions={<Button onClick={() => onOpenChange(false)}>Зрозуміло</Button>}
  >
    <div className="overflow-x-auto">
      <table className={tableStyles}>
        <thead className="text-fg-dim">
          <tr>
            <th scope="col" className={columnTitleStyles}>Рівень і правило</th>
            <th scope="col" className={columnTitleStyles}>Що означає</th>
            {!serious && <th scope="col" className={columnTitleStyles}>Підпис</th>}
          </tr>
        </thead>
        <tbody>
          {HEAT_ORDER.map((key) => {
            const level = HEAT_LEVELS[key];
            return (
              <tr key={key} className={levelRowStyles}>
                <th scope="row" className={levelTitleStyles}>
                  <span aria-hidden="true">{level.emoji}</span> {level.name}
                  <span className={ruleStyles}>{level.rule}</span>
                </th>
                <td className="px-2 py-2">{level.meaning}</td>
                {!serious && <td className={signatureStyles}>{level.joke}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </ResponsiveDialog>
);
