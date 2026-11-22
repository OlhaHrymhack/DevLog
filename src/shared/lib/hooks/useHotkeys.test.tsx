import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useHotkeys } from "./useHotkeys";

afterEach(cleanup);

it("DEV-005 AC-9: Cyrillic shortcut dispatches new task only outside inputs and dialogs", () => {
  const focusSearch = vi.fn();
  const onNewTask = vi.fn();
  const { rerender } = renderHook(({ open }) => useHotkeys(focusSearch, onNewTask, open), {
    initialProps: { open: false },
  });
  const press = (target: EventTarget, key: string) => {
    act(() => { target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
  };
  press(window, "Т");
  press(window, "/");
  expect(onNewTask).toHaveBeenCalledOnce();
  expect(focusSearch).toHaveBeenCalledOnce();
  const input = document.createElement("input");
  document.body.append(input);
  press(input, "N");
  input.remove();
  rerender({ open: true });
  press(window, "N");
  expect(onNewTask).toHaveBeenCalledOnce();
});
