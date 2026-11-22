import type { ReactNode, RefObject } from "react";

export type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Кнопки дій: у діалозі — внизу праворуч, у bottom sheet — липкі внизу. */
  actions?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  fallbackFocus?: () => HTMLElement | null;
  /** Широкий варіант (легенда температури, 760px). */
  wide?: boolean;
};
