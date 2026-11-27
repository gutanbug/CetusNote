import { Bot, Database, Keyboard, Palette, PenLine, Settings, type LucideIcon } from "lucide-react";
import { msg } from "@/lib/i18n";

// L5 설정 부품이 함께 쓰는 선택지 목록

export type SettingsTab = "general" | "appearance" | "editor" | "shortcuts" | "data" | "agent";

/** 탭 이름은 getter로 읽는다 — 부르는 순간의 언어 */
function tab(id: SettingsTab, icon: LucideIcon) {
  return {
    id,
    icon,
    get name() {
      return msg().page.options.tabs[id];
    },
  };
}

export const SETTINGS_TABS: { id: SettingsTab; name: string; icon: LucideIcon }[] = [
  tab("general", Settings),
  tab("appearance", Palette),
  tab("editor", PenLine),
  tab("shortcuts", Keyboard),
  tab("data", Database),
  // AI 연결 (DATA-12): MCP 서버 연결 상태와, 앞으로 넣을 개인 AI 에이전트·API 키 설정
  tab("agent", Bot),
];

export const settingsTabId = (prefix: string, tab: SettingsTab) => `${prefix}-tab-${tab}`;
export const settingsPanelId = (prefix: string, tab: SettingsTab) => `${prefix}-panel-${tab}`;

/** 포인트 색 8종 (tokens.md §3). 이름은 getter로 읽는다 */
const ACCENT_IDS = [
  "blue",
  "indigo",
  "violet",
  "teal",
  "green",
  "amber",
  "rose",
  "graphite",
] as const;
export const ACCENT_CHOICES = ACCENT_IDS.map((id) => ({
  id,
  get name() {
    return msg().page.options.accents[id];
  },
}));

export type AccentChoice = (typeof ACCENT_CHOICES)[number]["id"];
