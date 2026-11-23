import { Database, Keyboard, Palette, PenLine, Settings, type LucideIcon } from "lucide-react";

// L5 설정 부품이 함께 쓰는 선택지 목록

export type SettingsTab = "general" | "appearance" | "editor" | "shortcuts" | "data";

export const SETTINGS_TABS: { id: SettingsTab; name: string; icon: LucideIcon }[] = [
  { id: "general", name: "일반", icon: Settings },
  { id: "appearance", name: "외관", icon: Palette },
  { id: "editor", name: "에디터", icon: PenLine },
  { id: "shortcuts", name: "단축키", icon: Keyboard },
  { id: "data", name: "데이터 / 백업", icon: Database },
];

export const settingsTabId = (prefix: string, tab: SettingsTab) => `${prefix}-tab-${tab}`;
export const settingsPanelId = (prefix: string, tab: SettingsTab) => `${prefix}-panel-${tab}`;

/** 포인트 색 8종 (tokens.md §3) */
export const ACCENT_CHOICES = [
  { id: "blue", name: "블루" },
  { id: "indigo", name: "인디고" },
  { id: "violet", name: "바이올렛" },
  { id: "teal", name: "틸" },
  { id: "green", name: "그린" },
  { id: "amber", name: "앰버" },
  { id: "rose", name: "로즈" },
  { id: "graphite", name: "그래파이트" },
] as const;

export type AccentChoice = (typeof ACCENT_CHOICES)[number]["id"];
