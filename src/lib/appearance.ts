import { applyZoom, normalizeZoom } from "./zoom";

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
};

const CACHE_KEY = "cetusnote.appearance";
const dark = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

let current: AppearanceInput | null = null;
let unlisten: (() => void) | null = null;

function paint(a: AppearanceInput) {
  const root = document.documentElement;
  root.dataset.theme = a.theme === "system" ? (dark() ? "dark" : "light") : a.theme;
  root.dataset.accent = a.accent;
  root.style.setProperty("--font-scale", String(a.fontScale));
  root.style.colorScheme = root.dataset.theme;
  applyZoom(normalizeZoom(a.zoom ?? 1));
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
  });
}
