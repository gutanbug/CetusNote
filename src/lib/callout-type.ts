/**
 * 콜아웃 색 ↔ Markdown 콜아웃 종류 (DATA-04·DATA-08).
 * 내보내기는 GitHub 표준 종류(NOTE·TIP·WARNING·CAUTION·IMPORTANT)를 쓰고, 표준이 없는 색은
 * `CETUS-<색>`으로 적어 다시 가져와도 색이 그대로 돌아오게 한다.
 * 가져오기는 Obsidian 종류 이름도 받아들인다(모르는 종류는 파란색).
 */

export const CALLOUT_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;

export type CalloutColor = (typeof CALLOUT_COLORS)[number];

const TYPE_BY_COLOR: Partial<Record<CalloutColor, string>> = {
  blue: "NOTE",
  green: "TIP",
  yellow: "WARNING",
  red: "CAUTION",
  purple: "IMPORTANT",
};

const COLOR_BY_TYPE: Record<string, CalloutColor> = {
  NOTE: "blue",
  INFO: "blue",
  TODO: "blue",
  TIP: "green",
  HINT: "green",
  SUCCESS: "green",
  CHECK: "green",
  DONE: "green",
  WARNING: "yellow",
  QUESTION: "yellow",
  HELP: "yellow",
  FAQ: "yellow",
  ATTENTION: "yellow",
  CAUTION: "red",
  DANGER: "red",
  ERROR: "red",
  FAIL: "red",
  FAILURE: "red",
  MISSING: "red",
  BUG: "red",
  IMPORTANT: "purple",
  EXAMPLE: "purple",
  QUOTE: "gray",
  CITE: "gray",
  ABSTRACT: "gray",
  SUMMARY: "gray",
  TLDR: "gray",
};

const isColor = (c: string): c is CalloutColor => (CALLOUT_COLORS as readonly string[]).includes(c);

/** 색 → 콜아웃 종류 이름 (`[!NOTE]`의 NOTE) */
export function calloutTypeOf(color: string): string {
  const c = isColor(color) ? color : "blue";
  return TYPE_BY_COLOR[c] ?? `CETUS-${c}`;
}

/** 콜아웃 종류 이름 → 색. 모르는 이름은 파란색 */
export function calloutColorOf(type: string): CalloutColor {
  const upper = type.trim().toUpperCase();
  const own = /^CETUS-([A-Z]+)$/.exec(upper)?.[1]?.toLowerCase();
  if (own && isColor(own)) return own;
  return COLOR_BY_TYPE[upper] ?? "blue";
}
