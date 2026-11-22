import { useCallback } from "react";
import { toast } from "sonner";

/** Копіювання тексту в буфер: нічого не надсилається в мережу; помилка буфера — тост із підказкою. */
export const useCopyText = (serious: boolean) =>
  useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(serious ? "Апдейт скопійовано" : "📋 Скопійовано. Тепер вдай, що писав сам");
    } catch {
      toast.error("Не вдалося скопіювати. Виділіть текст вручну");
    }
  }, [serious]);
