import { useCallback, useState } from "react";

/** Відкладені задачі: стан сесії на клієнті (не зберігається; після перезавантаження сторінки скидається). */
export const useSnoozedIds = () => {
  const [snoozedIds, setSnoozedIds] = useState<readonly string[]>([]);
  const snooze = useCallback((id: string) => setSnoozedIds((previous) => (previous.includes(id) ? previous : [...previous, id])), []);
  return { snoozedIds, snooze };
};
