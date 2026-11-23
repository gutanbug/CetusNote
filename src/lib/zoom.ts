import { setWebviewZoom } from "@/lib/storage/webview-zoom";

/**
 * 화면 크기(SHELL-17) — ⌘+ / ⌘− / ⌘0. 80%~150% 사이를 단계로 오간다.
 * 80% 아래는 본문(15px)이 12px 밑으로 내려가 읽기 어렵고, 150% 위는 기본 창(1280)에서 사이드바와
 * 본문 폭(--content-w)이 함께 들어가지 않는다.
 */
export const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;

/** 저장된 값 → 가장 가까운 단계 (모르는 값이면 100%) */
export function normalizeZoom(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return ZOOM_STEPS.reduce(
    (best, s) => (Math.abs(s - value) < Math.abs(best - value) ? s : best),
    1,
  );
}

/** 한 단계 키우기(1) · 줄이기(-1) · 원래대로(0). 끝에 닿으면 그대로 */
export function stepZoom(current: number, dir: -1 | 0 | 1): number {
  if (dir === 0) return 1;
  const i = ZOOM_STEPS.indexOf(normalizeZoom(current) as (typeof ZOOM_STEPS)[number]);
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))]!;
}

/** 키보드 이벤트가 화면 크기 단축키면 방향, 아니면 null. ⌘= 와 ⌘⇧=(⌘+) 모두 키우기 */
export function zoomKey(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey">) {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null;
  if (e.key === "=" || e.key === "+") return 1;
  if (e.key === "-" || e.key === "_") return -1;
  if (e.key === "0") return 0;
  return null;
}

/** CSS zoom 경로: 배율을 <html>에 걸고, vh·vw 보정용 --css-zoom에도 같은 값을 적는다 */
function cssZoom(level: number) {
  const root = document.documentElement;
  root.style.zoom = level === 1 ? "" : String(level);
  root.style.setProperty("--css-zoom", String(level));
}

/** 웹뷰 배율 경로: 뷰포트 단위가 이미 배율에 맞춰 줄어드므로 보정하지 않는다 */
function nativeZoom() {
  const root = document.documentElement;
  root.style.zoom = "";
  root.style.setProperty("--css-zoom", "1");
}

/**
 * 앱은 웹뷰 배율(글자·레이아웃 모두 선명하게), 브라우저 미리보기는 CSS zoom.
 * 웹뷰 배율이 거절되면 CSS zoom으로 대신한다(배율 숫자만 바뀌고 화면은 그대로인 일이 없게).
 */
export function applyZoom(level: number) {
  const native = setWebviewZoom(level, (e) => {
    console.warn("웹뷰 배율을 바꾸지 못해 CSS zoom으로 대신해요", e);
    cssZoom(level);
  });
  if (native) nativeZoom();
  else cssZoom(level);
}
