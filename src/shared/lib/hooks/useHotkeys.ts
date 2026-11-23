"use client";

import { useEffect } from "react";

export const useHotkeys = (onSearch: () => void, onNewTask?: () => void, dialogOpen = false) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing
        || event.ctrlKey || event.metaKey || event.altKey || dialogOpen) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true], [aria-modal=true]")) return;

      if (event.key === "/") {
        event.preventDefault();
        onSearch();
      } else if (onNewTask && ["n", "N", "т", "Т"].includes(event.key)) {
        event.preventDefault();
        onNewTask();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSearch, onNewTask, dialogOpen]);
};
