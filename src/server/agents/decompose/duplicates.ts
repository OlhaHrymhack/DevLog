const PREFIX_LENGTH = 12;

/** Нижній регістр без пунктуації й зайвих пробілів. */
export const normalizeTitle = (title: string): string =>
  title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

/** Дублікат: збіг перших 12 символів або вкладення однієї нормалізованої назви в іншу. */
export const isDuplicateTitle = (a: string, b: string): boolean => {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (left === "" || right === "") return false;
  return left.slice(0, PREFIX_LENGTH) === right.slice(0, PREFIX_LENGTH) || left.includes(right) || right.includes(left);
};
