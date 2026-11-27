import { parseLanguagePref, resolveLocale, setLocale, type LanguagePref } from "./i18n";
import { applyZoom, normalizeZoom } from "./zoom";
import { getStorage } from "./storage/default";
import { parseAppIconPref, resolveAppIcon, type AppIconPref } from "./app-icon";

/**
 * 외관 적용 (SET-03) — <html>에 data-theme · data-accent · --font-scale을 단다.
 * 설정 파일은 비동기로 읽으므로, 첫 화면이 번쩍이지 않게 마지막 값을 localStorage에 둔다(편의용 캐시).
 */
export type AppearanceInput = {
  theme: "light" | "dark" | "system";
  accent: string;
  fontScale: number;
  /** 화면 크기(SHELL-17). 없으면 100% */
  zoom?: number;
  /** 앱 아이콘(SET-07). 없으면 자동 */
  appIcon?: AppIconPref;
  /** 화면 언어(SYS-14). 없으면 시스템 */
  language?: LanguagePref;
};

const CACHE_KEY = "cetusnote.appearance";
const dark = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

let current: AppearanceInput | null = null;
/** 마지막으로 보낸 앱 아이콘 — 같은 값이면 다시 보내지 않는다 */
let lastIcon: string | null = null;
let unlisten: (() => void) | null = null;

/** 앱 아이콘을 지금 테마에 맞춰 바꾼다(SET-07). 실패하면 다음번에 다시 보낸다 */
function syncAppIcon(a: AppearanceInput, theme: "light" | "dark") {
  const icon = resolveAppIcon(parseAppIconPref(a.appIcon), theme);
  if (icon === lastIcon) return;
  lastIcon = icon;
  getStorage()
    .setAppIcon(icon)
    .catch(() => {
      lastIcon = null;
    });
}

function paint(a: AppearanceInput) {
  const root = document.documentElement;
  const theme: "light" | "dark" = a.theme === "system" ? (dark() ? "dark" : "light") : a.theme;
  root.dataset.theme = theme;
  syncAppIcon(a, theme);
  root.dataset.accent = a.accent;
  root.style.setProperty("--font-scale", String(a.fontScale));
  root.style.colorScheme = root.dataset.theme;
  applyZoom(normalizeZoom(a.zoom ?? 1));
  setLocale(resolveLocale(a.language ?? "system"));
}

export function applyAppearance(a: AppearanceInput) {
  current = a;
  paint(a);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(a));
  } catch {
    // 캐시는 없어도 된다
  }
  // "시스템"이면 OS 설정이 바뀔 때 따라간다
  if (!unlisten && typeof matchMedia === "function") {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => current?.theme === "system" && paint(current);
    mq.addEventListener("change", onChange);
    unlisten = () => mq.removeEventListener("change", onChange);
  }
}

/** 시작할 때 한 번 — 지난번 값(없으면 시스템 테마) */
export function applyCachedAppearance() {
  let cached: Partial<AppearanceInput>;
  try {
    cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Partial<AppearanceInput>;
  } catch {
    cached = {};
  }
  paint({
    theme: cached.theme === "light" || cached.theme === "dark" ? cached.theme : "system",
    accent: typeof cached.accent === "string" ? cached.accent : "blue",
    fontScale: typeof cached.fontScale === "number" ? cached.fontScale : 1,
    zoom: normalizeZoom(cached.zoom ?? 1),
    appIcon: parseAppIconPref(cached.appIcon),
    language: parseLanguagePref(cached.language),
  });
}
