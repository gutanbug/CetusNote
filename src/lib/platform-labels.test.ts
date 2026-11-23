import { describe, expect, it } from "vitest";
import {
  detectPlatform,
  formatKey,
  formatShortcut,
  isModPressed,
  revealLabel,
} from "./platform-labels";

const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15";
const WIN_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const LINUX_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15";

describe("detectPlatform", () => {
  it("UA로 운영체제를 가린다", () => {
    expect(detectPlatform(MAC_UA)).toBe("mac");
    expect(detectPlatform(WIN_UA)).toBe("windows");
    expect(detectPlatform(LINUX_UA)).toBe("linux");
  });

  it("개발용 override를 받되 알 수 없는 값은 무시한다", () => {
    expect(detectPlatform(MAC_UA, "windows")).toBe("windows");
    expect(detectPlatform(WIN_UA, "linux")).toBe("linux");
    expect(detectPlatform(WIN_UA, "solaris")).toBe("windows");
  });
});

describe("formatKey / formatShortcut", () => {
  it("macOS 기호는 그대로 둔다", () => {
    expect(formatKey("⌘", "mac")).toBe("⌘");
    expect(formatShortcut("⌥⌘F", "mac")).toBe("⌥⌘F");
  });

  it("Windows·Linux는 Ctrl·Alt·Shift·Enter로 바꾼다", () => {
    expect(formatKey("⌘", "windows")).toBe("Ctrl");
    expect(formatKey("⌥", "linux")).toBe("Alt");
    expect(formatKey("↵", "windows")).toBe("Enter");
    expect(formatKey("K", "windows")).toBe("K");
  });

  it("붙여 쓴 단축키를 + 로 잇는다", () => {
    expect(formatShortcut("⌥⌘F", "windows")).toBe("Alt+Ctrl+F");
    expect(formatShortcut("⇧Enter", "linux")).toBe("Shift+Enter");
    expect(formatShortcut("⌘\\", "windows")).toBe("Ctrl+\\");
    expect(formatShortcut("⌘⇧K", "windows")).toBe("Ctrl+Shift+K");
  });
});

describe("isModPressed", () => {
  it("macOS는 ⌘, 그 밖은 Ctrl을 주 수식키로 본다", () => {
    expect(isModPressed({ metaKey: true, ctrlKey: false }, "mac")).toBe(true);
    expect(isModPressed({ metaKey: false, ctrlKey: true }, "mac")).toBe(false);
    expect(isModPressed({ metaKey: false, ctrlKey: true }, "windows")).toBe(true);
    expect(isModPressed({ metaKey: true, ctrlKey: false }, "linux")).toBe(false);
  });
});

describe("revealLabel", () => {
  it("운영체제별 파일 위치 문구", () => {
    expect(revealLabel("mac")).toBe("Finder에서 보기");
    expect(revealLabel("windows")).toBe("탐색기에서 보기");
    expect(revealLabel("linux")).toBe("파일 관리자에서 보기");
  });
});
