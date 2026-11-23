import { useEffect, useState } from "react";
import { useMediaQuery } from "@/shared/lib/hooks/useMediaQuery";

export const TYPING_CHARS_PER_TICK = 3;
export const TYPING_TICK_MS = 14;

/** Друк тексту по 3 символи / 14 мс; без анімації при `enabled = false` або `prefers-reduced-motion`. */
export const useTypewriter = (text: string, enabled: boolean) => {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const instant = !enabled || reduced;
  const [progress, setProgress] = useState({ text, count: 0 });
  const count = progress.text === text ? progress.count : 0;
  const typing = !instant && count < text.length;

  useEffect(() => {
    if (!typing) return;
    const timer = setInterval(() => {
      setProgress((previous) => {
        const base = previous.text === text ? previous.count : 0;
        return { text, count: Math.min(text.length, base + TYPING_CHARS_PER_TICK) };
      });
    }, TYPING_TICK_MS);
    return () => clearInterval(timer);
  }, [text, typing]);

  return { shown: instant ? text : text.slice(0, count), typing };
};
