/** Підміняє window.matchMedia: усі запити повертають однакове `matches`. */
export function mockMatchMedia(matches: boolean): void {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
