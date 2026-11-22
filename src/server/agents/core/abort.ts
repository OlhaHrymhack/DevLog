import "server-only";

export const createAbortError = () => new DOMException("Запуск агента зупинено", "AbortError");

/** Відхиляє одразу після abort, навіть якщо сам `promise` сигнал ігнорує; пізній результат відкидається. */
export const abortable = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) return Promise.reject(createAbortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (error: unknown) => { signal.removeEventListener("abort", onAbort); reject(error); },
    );
  });
};

export const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  abortable(new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  }), signal);
