/** 앱이 도는 운영체제. 브라우저 미리보기·Storybook은 UA로 판별한다 (SYS-08) */
export type Platform = "mac" | "windows" | "linux";

const PLATFORMS: readonly Platform[] = ["mac", "windows", "linux"];

/**
 * UA 문자열로 운영체제를 정한다. 맥·Windows가 아니면 linux로 본다(문구의 기본).
 * 개발 빌드에서만 `?platform=windows` 같은 주소 인자로 바꿔 볼 수 있다(브라우저 미리보기 검사용).
 */
export function detectPlatform(userAgent: string, override?: string | null): Platform {
  if (override && (PLATFORMS as readonly string[]).includes(override)) return override as Platform;
  if (/Mac|iPhone|iPad|iPod/i.test(userAgent)) return "mac";
  if (/Win/i.test(userAgent)) return "windows";
  return "linux";
}

/** 캐시한 운영체제 값 */
let cached: Platform | null = null;

/** 지금 운영체제 (한 번 정하면 바뀌지 않는다). 테스트에서는 detectPlatform을 직접 쓴다 */
export function currentPlatform(): Platform {
  if (cached) return cached;
  if (typeof navigator === "undefined") return "mac";
  let override: string | null = null;
  if (import.meta.env.DEV && typeof location !== "undefined") {
    override = new URLSearchParams(location.search).get("platform");
  }
  cached = detectPlatform(navigator.userAgent, override);
  return cached;
}

/** 단축키 기호 하나를 운영체제 표기로 바꾼다. macOS 기호는 그대로 둔다 */
const KEY_LABELS: Record<Platform, Record<string, string>> = {
  mac: {},
  windows: { "⌘": "Ctrl", "⌃": "Ctrl", "⌥": "Alt", "⇧": "Shift", "↵": "Enter" },
  linux: { "⌘": "Ctrl", "⌃": "Ctrl", "⌥": "Alt", "⇧": "Shift", "↵": "Enter" },
};

/** 키 하나(`⌘`, `K`, `↵` …)의 표시 글자 */
export function formatKey(key: string, platform: Platform): string {
  return KEY_LABELS[platform][key] ?? key;
}

/**
 * 붙여 쓴 단축키 글자(`⌥⌘F`, `⇧Enter`)를 표시 글자로 바꾼다.
 * macOS는 그대로 붙여 쓰고, Windows·Linux는 `Alt+Ctrl+F`처럼 `+`로 잇는다.
 */
export function formatShortcut(text: string, platform: Platform): string {
  if (platform === "mac") return text;
  const parts: string[] = [];
  let literal = "";
  for (const ch of text) {
    const label = KEY_LABELS[platform][ch];
    if (label) {
      if (literal) parts.push(literal);
      literal = "";
      parts.push(label);
    } else {
      literal += ch;
    }
  }
  if (literal) parts.push(literal);
  return parts.join("+");
}

/** 주 수식키(⌘ 또는 Ctrl)가 눌렸는가. macOS는 ⌘(metaKey), 그 밖은 Ctrl(ctrlKey) */
export function isModPressed(
  e: { metaKey: boolean; ctrlKey: boolean },
  platform: Platform,
): boolean {
  return platform === "mac" ? e.metaKey : e.ctrlKey;
}

/** 파일 위치 열기 버튼 문구 (SHELL·SET·DATA-04/05) */
export function revealLabel(platform: Platform): string {
  if (platform === "windows") return "탐색기에서 보기";
  if (platform === "linux") return "파일 관리자에서 보기";
  return "Finder에서 보기";
}
