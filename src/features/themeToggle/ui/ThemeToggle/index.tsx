"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { DEFAULT_THEME, applyTheme, readTheme, subscribeToTheme } from "../../model/theme";

/** Темна тема — Sun («увімкнути світлу»), світла — Moon («увімкнути темну»). */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => DEFAULT_THEME);
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
      onClick={() => applyTheme(isDark ? "light" : "dark")}
    >
      <Icon aria-hidden="true" className="size-4" />
    </Button>
  );
}
