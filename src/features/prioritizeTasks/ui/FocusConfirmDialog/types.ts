export type FocusConfirmDialogProps = {
  /** Задачі у порядку фокусу (№ 1, 2, 3). */
  tasks: readonly { id: string; title: string }[];
  /** План від fallback-правила: інший заголовок діалогу. */
  fromRule?: boolean;
  serious: boolean;
  onClose: () => void;
  /** Фокус збережено на сервері. */
  onApplied: () => void;
};
