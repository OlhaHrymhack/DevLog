"use client";

import { useRef } from "react";
import { useMediaQuery } from "@/shared/lib/hooks/useMediaQuery";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/Dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/Sheet";
import {
  descriptionStyles,
  dialogActionsStyles,
  dialogContentStyles,
  sheetActionsStyles,
  sheetContentStyles,
  titleStyles,
} from "./styles";
import type { ResponsiveDialogProps } from "./types";

/** Діалог по центру ≥ 768px, bottom sheet з липкими діями < 768px. Фокус-пастка, Esc і повернення фокусу — від Radix. */
export const ResponsiveDialog = ({ open, onOpenChange, title, description, children, actions, wide = false, initialFocus, fallbackFocus }: ResponsiveDialogProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)", true);
  const openerRef = useRef<HTMLElement | null>(null);

  // Діалог контрольований і без DialogTrigger: Radix сам не знає, куди повернути фокус.
  // Запам'ятовуємо елемент у момент відкриття (фокус ще не перейшов у діалог) і повертаємо при закритті.
  const focusHandlers = {
    onOpenAutoFocus: (event: Event) => {
      const opener = document.activeElement;
      openerRef.current = opener instanceof HTMLElement && opener !== document.body ? opener : null;
      if (initialFocus?.current) {
        event.preventDefault();
        initialFocus.current.focus();
      }
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      const opener = openerRef.current;
      if (opener?.isConnected && !opener.matches(":disabled")) {
        opener.focus();
        if (document.activeElement === opener) return;
      }
      fallbackFocus?.()?.focus();
    },
  };

  const accessibilityProps = {
    "aria-modal": true,
    ...(!description ? { "aria-describedby": undefined } : {}),
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={dialogContentStyles({ wide })} {...focusHandlers} {...accessibilityProps}>
          <DialogHeader>
            <DialogTitle className={titleStyles}>{title}</DialogTitle>
            {description ? <DialogDescription className={descriptionStyles}>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          {actions ? <div className={dialogActionsStyles}>{actions}</div> : null}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={sheetContentStyles} {...focusHandlers} {...accessibilityProps}>
        <SheetHeader className="p-0">
          <SheetTitle className={titleStyles}>{title}</SheetTitle>
          {description ? <SheetDescription className={descriptionStyles}>{description}</SheetDescription> : null}
        </SheetHeader>
        {children}
        {actions ? <div className={sheetActionsStyles}>{actions}</div> : null}
      </SheetContent>
    </Sheet>
  );
};
