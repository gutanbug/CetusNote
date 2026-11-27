import { describe, expect, it } from "vitest";
import {
  acceleratorFromEvent,
  displayKeys,
  validateShortcut,
  type ShortcutKeyEvent,
} from "./shortcut";

const key = (code: string, mods: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe("acceleratorFromEvent", () => {
  it("builds the default ⌥⇧Space in Tauri order", () => {
    expect(acceleratorFromEvent(key("Space", { altKey: true, shiftKey: true }))).toBe(
      "Alt+Shift+Space",
    );
  });
  it("orders modifiers Ctrl, Alt, Shift, Super regardless of press order", () => {
    expect(acceleratorFromEvent(key("KeyK", { metaKey: true, ctrlKey: true }))).toBe(
      "Ctrl+Super+K",
    );
  });
  it("uses the physical key, so layout does not matter", () => {
    expect(acceleratorFromEvent(key("Digit7", { metaKey: true }))).toBe("Super+7");
    expect(acceleratorFromEvent(key("ArrowUp", { altKey: true }))).toBe("Alt+Up");
  });
  it("returns null for modifier-only and unknown keys", () => {
    expect(acceleratorFromEvent(key("ShiftLeft", { shiftKey: true }))).toBeNull();
    expect(acceleratorFromEvent(key("MetaLeft", { metaKey: true }))).toBeNull();
    expect(acceleratorFromEvent(key("IntlRo", { altKey: true }))).toBeNull();
  });
});

describe("displayKeys", () => {
  it("maps modifiers to symbols and keeps key names", () => {
    expect(displayKeys("Alt+Shift+Space")).toEqual(["⌥", "⇧", "Space"]);
    expect(displayKeys("Ctrl+Super+Up")).toEqual(["⌃", "⌘", "↑"]);
  });
});

describe("validateShortcut", () => {
  it("accepts a key with at least one modifier", () => {
    expect(validateShortcut("Alt+Shift+Space")).toBeNull();
    expect(validateShortcut("Ctrl+K")).toBeNull();
  });
  it("requires a modifier", () => {
    expect(validateShortcut("Space")).toBe("no_modifier");
    expect(validateShortcut("")).toBe("no_modifier");
  });
  it("rejects ⌘Space and ⌥Space", () => {
    expect(validateShortcut("Super+Space")).toBe("reserved");
    expect(validateShortcut("Alt+Space")).toBe("reserved");
    expect(validateShortcut("Super+Shift+Space")).toBeNull();
  });
});
