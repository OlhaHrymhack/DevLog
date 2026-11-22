"use client";

import { useRef, useState, type MouseEvent } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { emojiStyles, heatButtonStyles, tooltipJokeStyles, tooltipStyles, tooltipTitleStyles } from "./styles";
import type { HeatBadgeProps } from "./types";

/**
 * Кнопка-температура з tooltip (hover, фокус). На тач і за кліком tooltip перемикається тапом:
 * Radix закриває його на pointerdown/click, тож стан тримаємо самі (контрольований режим).
 */
export function HeatBadge({ level, serious = false, always = false }: HeatBadgeProps) {
  const [open, setOpen] = useState(false);
  const openAtPointerDown = useRef<boolean | null>(null);

  if (!level.show && !always) return null;

  function handlePointerDown() {
    openAtPointerDown.current = open;
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const wasOpen = openAtPointerDown.current ?? open;
    openAtPointerDown.current = null;
    setOpen(!wasOpen);
  }

  const isAnimated = level.key === "fire" || level.key === "alarm";

  return (
    <TooltipProvider disableHoverableContent>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          type="button"
          aria-label={`Температура: ${level.name}. ${level.meaning}`}
          className={heatButtonStyles({ siren: level.key === "alarm" })}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        >
          <span aria-hidden="true" className={emojiStyles({ animated: isAnimated })}>
            {level.emoji}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" sideOffset={6} className={tooltipStyles}>
          <b className={tooltipTitleStyles}>{level.name}</b>
          {level.meaning}
          {serious ? null : <i className={tooltipJokeStyles}>«{level.joke}»</i>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
