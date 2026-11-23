"use client";

import { useSyncExternalStore } from "react";

// Dev-прапорець «Зламати відповідь агента»: спільний клієнтський стан між панеллю станів і запусками агентів.
// У production завжди false — сервер однаково відхилить поле `debug` (400).
const isDevelopment = process.env.NODE_ENV !== "production";
const listeners = new Set<() => void>();
let forceInvalidOutput = false;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getForceInvalidOutput = () => isDevelopment && forceInvalidOutput;

export const setForceInvalidOutput = (value: boolean) => {
  if (!isDevelopment) return;
  forceInvalidOutput = value;
  listeners.forEach((listener) => listener());
};

export const useForceInvalidOutput = () => useSyncExternalStore(subscribe, getForceInvalidOutput, () => false);
