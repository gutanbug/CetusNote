// Debug 툴바 설정. URL 해시 쿼리(#/debug?theme=both&accent=teal)에 남겨
// 같은 상태로 스크린샷을 다시 찍을 수 있게 한다 (docs/dev/debug-screen.md §4).

export const ACCENTS = [
  "blue",
  "indigo",
  "violet",
  "teal",
  "green",
  "amber",
  "rose",
  "graphite",
] as const;

export type Theme = "light" | "dark" | "both";
export type Force = "none" | "hover" | "active";
export type Width = "full" | "1440" | "1024";

export interface DebugSettings {
  theme: Theme;
  accent: (typeof ACCENTS)[number];
  scale: "0.9" | "1" | "1.1";
  width: Width;
  reduced: boolean;
  force: Force;
  grid: boolean;
  q: string;
}

export const DEFAULTS: DebugSettings = {
  theme: "both",
  accent: "blue",
  scale: "1",
  width: "full",
  reduced: false,
  force: "none",
  grid: false,
  q: "",
};

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseSettings(hash: string): DebugSettings {
  const query = new URLSearchParams(hash.split("?")[1] ?? "");
  return {
    theme: pick(query.get("theme"), ["light", "dark", "both"], DEFAULTS.theme),
    accent: pick(query.get("accent"), ACCENTS, DEFAULTS.accent),
    scale: pick(query.get("scale"), ["0.9", "1", "1.1"], DEFAULTS.scale),
    width: pick(query.get("width"), ["full", "1440", "1024"], DEFAULTS.width),
    reduced: query.get("reduced") === "1",
    force: pick(query.get("force"), ["none", "hover", "active"], DEFAULTS.force),
    grid: query.get("grid") === "1",
    q: query.get("q") ?? "",
  };
}

/** 기본값과 다른 항목만 쿼리에 남긴다 */
export function serializeSettings(s: DebugSettings, path = "#/debug"): string {
  const query = new URLSearchParams();
  for (const key of Object.keys(DEFAULTS) as (keyof DebugSettings)[]) {
    const value = s[key];
    if (value === DEFAULTS[key]) continue;
    query.set(key, typeof value === "boolean" ? (value ? "1" : "0") : value);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
