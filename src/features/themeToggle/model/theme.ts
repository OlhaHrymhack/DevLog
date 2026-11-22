export const THEME_STORAGE_KEY = "devlog-theme";

export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

/**
 * Інлайн-скрипт для `<head>`: ставить `data-theme` до гідратації, тож збережена світла тема
 * не мерехтить темною (AC-4). Значення за замовчуванням (`dark`) уже стоїть у розмітці з сервера.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : DEFAULT_THEME;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // приватний режим / вимкнений storage: тема діє до перезавантаження
  }
}

export function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
