/**
 * 단축키 조합 도우미 (PG-ShortcutRecorder, QN-03). 순수 함수라 화면 없이 테스트한다.
 * 조합 문자열은 Tauri 전역 단축키 형식이다: "Alt+Shift+Space" (수식키 순서: Ctrl · Alt · Shift · Super).
 * Super는 ⌘이다.
 */

type Modifier = "Ctrl" | "Alt" | "Shift" | "Super";

const MODIFIER_SYMBOL: Record<Modifier, string> = {
  Ctrl: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Super: "⌘",
};

const KEY_SYMBOL: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
  Backspace: "⌫",
  Delete: "⌦",
  Escape: "Esc",
};

export type ShortcutIssue = "no_modifier" | "reserved";

export type ShortcutKeyEvent = {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

/** KeyboardEvent.code를 단축키 키 이름으로 바꾼다. 모르는 키는 null */
function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|20)$/.test(code)) return code;
  if (code in KEY_SYMBOL) return code === "Escape" ? null : code;
  if (code === "ArrowUp") return "Up";
  if (code === "ArrowDown") return "Down";
  if (code === "ArrowLeft") return "Left";
  if (code === "ArrowRight") return "Right";
  if (code === "Minus") return "-";
  if (code === "Equal") return "=";
  if (code === "Comma") return ",";
  if (code === "Period") return ".";
  if (code === "Slash") return "/";
  if (code === "Semicolon") return ";";
  if (code === "Quote") return "'";
  if (code === "BracketLeft") return "[";
  if (code === "BracketRight") return "]";
  if (code === "Backslash") return "\\";
  if (code === "Backquote") return "`";
  return null;
}

/** 키 입력을 조합 문자열로 만든다. 수식키만 눌렀거나 모르는 키면 null (아직 완성되지 않음) */
export function acceleratorFromEvent(e: ShortcutKeyEvent): string | null {
  const key = keyName(e.code);
  if (!key) return null;
  const mods: Modifier[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Super");
  return [...mods, key].join("+");
}

/** 조합을 화면에 찍을 키 목록으로 바꾼다 (UI-Kbd 한 개씩). "Alt+Shift+Space" → ["⌥", "⇧", "Space"] */
export function displayKeys(accelerator: string): string[] {
  return accelerator
    .split("+")
    .filter(Boolean)
    .map((part) => {
      if (part in MODIFIER_SYMBOL) return MODIFIER_SYMBOL[part as Modifier];
      return KEY_SYMBOL[part] ?? part;
    });
}

/**
 * 조합을 검사한다. 수식키가 하나 이상 있어야 하고, ⌘Space·⌥Space는 시스템(Spotlight, 입력 전환)이 쓰므로 막는다.
 * 통과하면 null. Rust `shortcut::validate`와 같은 규칙이다.
 */
export function validateShortcut(accelerator: string): ShortcutIssue | null {
  const parts = accelerator.split("+").filter(Boolean);
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  if (!key || mods.length === 0) return "no_modifier";
  if (key === "Space" && mods.length === 1 && (mods[0] === "Super" || mods[0] === "Alt")) {
    return "reserved";
  }
  return null;
}
