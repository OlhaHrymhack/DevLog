import { mockMatchMedia } from "../utils/matchMedia";

// jsdom не має ResizeObserver (потрібен Radix Popper/Tooltip) і matchMedia (useMediaQuery).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub;
mockMatchMedia(false);
