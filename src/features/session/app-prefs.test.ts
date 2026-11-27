import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_PREFS } from "./store";

const apply = vi.hoisted(() => vi.fn<(prefs: unknown) => Promise<void>>());

vi.mock("@/lib/storage/window", () => ({ applyAppPrefs: apply }));
vi.mock("@/features/session", async () => {
  const { createSessionStore } = await import("./store");
  const { createMemoryStorage } = await import("@/lib/storage");
  return { sessionStore: createSessionStore(createMemoryStorage(), { delay: 10 }) };
});

const { changeAppPrefs } = await import("./app-prefs");
const { sessionStore } = await import("@/features/session");

beforeEach(() => {
  apply.mockReset();
  apply.mockResolvedValue(undefined);
  sessionStore.getState().setAppPrefs({ ...DEFAULT_APP_PREFS });
});

describe("changeAppPrefs (SYS-15, QN-03)", () => {
  it("바꾼 값을 스토어에 넣고 전체 설정을 Rust에 넘긴다", async () => {
    const result = await changeAppPrefs({ doubleTap: "shift" });
    expect(result).toEqual({ ok: true });
    expect(sessionStore.getState().doubleTap).toBe("shift");
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({
      menuBarResident: true,
      launchAtLogin: false,
      quickShortcut: "Alt+Shift+Space",
      doubleTap: "shift",
    });
  });

  it("단축키 등록에 실패하면 이전 단축키로 되돌리고 되돌린 값을 Rust에 다시 맞춘다", async () => {
    apply
      .mockRejectedValueOnce({ code: "shortcut_unavailable", message: "x" })
      .mockResolvedValueOnce(undefined);
    const result = await changeAppPrefs({ quickShortcut: "Control+Shift+K" });
    expect(result).toEqual({
      ok: false,
      code: "shortcut_unavailable",
      reverted: { quickShortcut: "Alt+Shift+Space" },
    });
    expect(sessionStore.getState().quickShortcut).toBe("Alt+Shift+Space");
    expect(apply).toHaveBeenLastCalledWith(
      expect.objectContaining({ quickShortcut: "Alt+Shift+Space" }),
    );
  });

  it("손쉬운 사용 권한이 없으면 두 번 누르기만 끄고 나머지 변경은 그대로 둔다", async () => {
    apply
      .mockRejectedValueOnce({ code: "accessibility_required" })
      .mockResolvedValueOnce(undefined);
    const result = await changeAppPrefs({ doubleTap: "command", launchAtLogin: true });
    expect(result).toEqual({
      ok: false,
      code: "accessibility_required",
      reverted: { doubleTap: "off" },
    });
    expect(sessionStore.getState()).toMatchObject({ doubleTap: "off", launchAtLogin: true });
  });

  it("모르는 오류는 되돌리지 않고 unknown으로 알린다", async () => {
    apply.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    const result = await changeAppPrefs({ menuBarResident: false });
    expect(result).toEqual({ ok: false, code: "unknown", reverted: {} });
    expect(sessionStore.getState().menuBarResident).toBe(false);
  });
});
