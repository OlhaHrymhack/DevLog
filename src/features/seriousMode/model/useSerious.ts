"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "devlog-serious";
const EVENT = "devlog-serious-change";
const isDevelopment = process.env.NODE_ENV !== "production";

const subscribe = (listener: () => void) => {
  if (!isDevelopment) return () => undefined;
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
};

const getSnapshot = () => isDevelopment && localStorage.getItem(STORAGE_KEY) === "true";

export const useSerious = () => useSyncExternalStore(subscribe, getSnapshot, () => false);

export const setSerious = (value: boolean) => {
  if (!isDevelopment) return;
  localStorage.setItem(STORAGE_KEY, String(value));
  window.dispatchEvent(new Event(EVENT));
};
