import { applyAppPrefs, type AppPrefsInput } from "@/lib/storage/window";
import { sessionStore } from "@/features/session";
import { DEFAULT_APP_PREFS, type AppPrefs } from "./store";

/** Rust가 돌려주는 사유 코드. 화면이 이 코드로 안내 문구를 고른다 (SYS-15, QN-03) */
export type AppPrefsFailure = "shortcut_unavailable" | "accessibility_required" | "unknown";

export type AppPrefsResult =
  { ok: true } | { ok: false; code: AppPrefsFailure; reverted: Partial<AppPrefs> };

function currentPrefs(): AppPrefs {
  const s = sessionStore.getState();
  return {
    menuBarResident: s.menuBarResident,
    launchAtLogin: s.launchAtLogin,
    quickShortcut: s.quickShortcut,
    doubleTap: s.doubleTap,
  };
}

function toInput(p: AppPrefs): AppPrefsInput {
  return {
    menuBarResident: p.menuBarResident,
    launchAtLogin: p.launchAtLogin,
    quickShortcut: p.quickShortcut,
    doubleTap: p.doubleTap,
  };
}

function failureCode(e: unknown): AppPrefsFailure {
  const code =
    typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : e;
  if (code === "shortcut_unavailable" || code === "accessibility_required") return code;
  return "unknown";
}

/** 앱을 열 때 저장된 설정을 Rust에 적용한다. 실패해도 화면은 저장된 값을 그대로 보여 준다 */
export async function applyStoredAppPrefs(): Promise<AppPrefsResult> {
  return changeAppPrefs({});
}

/**
 * 설정 하나(또는 여럿)를 바꾸고 Rust에 적용한다.
 * 실패하면 원인 항목만 되돌린다: 단축키는 이전 값, 두 번 누르기는 끔 (권한이 없을 때).
 */
export async function changeAppPrefs(patch: Partial<AppPrefs>): Promise<AppPrefsResult> {
  const prev = currentPrefs();
  const next: AppPrefs = { ...prev, ...patch };
  sessionStore.getState().setAppPrefs(next);
  try {
    await applyAppPrefs(toInput(next));
    return { ok: true };
  } catch (e) {
    const code = failureCode(e);
    const reverted: Partial<AppPrefs> = {};
    if (code === "shortcut_unavailable") reverted.quickShortcut = prev.quickShortcut;
    if (code === "accessibility_required") reverted.doubleTap = DEFAULT_APP_PREFS.doubleTap;
    const fixed: AppPrefs = { ...next, ...reverted };
    sessionStore.getState().setAppPrefs(fixed);
    // 되돌린 값을 Rust에도 다시 맞춘다 (실패 사유는 이미 알렸으므로 무시한다)
    await applyAppPrefs(toInput(fixed)).catch(() => undefined);
    return { ok: false, code, reverted };
  }
}
