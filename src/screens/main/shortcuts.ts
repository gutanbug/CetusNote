import { SLASH_ITEMS } from "@/components/editor/slash-items";
import { msg, type Messages } from "@/lib/i18n";

type ShortcutMessages = Messages["screens"]["shortcuts"];

/**
 * 단축키 목록 (SET-05) — 설정 → 단축키에 그대로 보인다.
 * 단축키를 더하거나 바꾸면 여기도 같이 고친다(앱: main-screen.tsx·command-palette.tsx, 에디터: extensions.ts·floating-toolbar.tsx).
 */
export type Shortcut = { name: string; keys: string[] };
export type ShortcutGroup = { title: string; items: Shortcut[] };

const appShortcuts = (s: ShortcutMessages): Shortcut[] => [
  { name: s.app.palette, keys: ["⌘", "K"] },
  { name: s.app.newPage, keys: ["⌘", "N"] },
  { name: s.app.quickNote, keys: ["⌘", "⇧", "N"] },
  { name: s.app.dailyNote, keys: ["⌥", "⌘", "T"] },
  { name: s.app.templates, keys: ["⌘", "⇧", "T"] },
  { name: s.app.newTab, keys: ["⌘", "T"] },
  { name: s.app.closeTab, keys: ["⌘", "W"] },
  { name: s.app.nextTab, keys: ["⌃", "Tab"] },
  { name: s.app.tabN, keys: ["⌘", "1–9"] },
  { name: s.app.duplicate, keys: ["⌘", "D"] },
  { name: s.app.settings, keys: ["⌘", ","] },
  { name: s.app.sidebar, keys: ["⌘", "\\"] },
  { name: s.app.focus, keys: ["⌘", "."] },
  { name: s.app.toc, keys: ["⌥", "⌘", "O"] },
  { name: s.app.zoom, keys: ["⌘", "+ / −"] },
  { name: s.app.zoomReset, keys: ["⌘", "0"] },
];

const editShortcuts = (s: ShortcutMessages): Shortcut[] => [
  { name: s.edit.bold, keys: ["⌘", "B"] },
  { name: s.edit.italic, keys: ["⌘", "I"] },
  { name: s.edit.underline, keys: ["⌘", "U"] },
  { name: s.edit.strike, keys: ["⌘", "⇧", "S"] },
  { name: s.edit.code, keys: ["⌘", "E"] },
  { name: s.edit.link, keys: ["⌘", "⇧", "K"] },
  { name: s.edit.highlight, keys: ["⌘", "⇧", "H"] },
  { name: s.edit.sup, keys: ["⌘", "⇧", "."] },
  { name: s.edit.sub, keys: ["⌘", "⇧", ","] },
  { name: s.edit.moveUp, keys: ["⌘", "⇧", "↑"] },
  { name: s.edit.moveDown, keys: ["⌘", "⇧", "↓"] },
  { name: s.edit.undo, keys: ["⌘", "Z"] },
  { name: s.edit.redo, keys: ["⌘", "⇧", "Z"] },
  { name: s.edit.blockMenu, keys: ["/"] },
  { name: s.edit.handleMenu, keys: ["⌘", "/"] },
  { name: s.edit.indent, keys: ["Tab", "⇧Tab"] },
  { name: s.edit.leaveBody, keys: ["Esc", "Tab"] },
  { name: s.edit.tableToolbar, keys: ["⌥", "F10"] },
  { name: s.edit.formatBar, keys: ["⌥", "F10"] },
  { name: s.edit.find, keys: ["⌘", "F"] },
  { name: s.edit.replace, keys: ["⌥", "⌘", "F"] },
];

/** 마크다운 단축 입력은 슬래시 메뉴 항목의 힌트에서 가져온다(한 곳에서만 고치게) */
const markdownShortcuts = (): Shortcut[] =>
  SLASH_ITEMS.filter((i) => i.hint).map((i) => ({
    name: i.title,
    keys: [i.hint!],
  }));

/** 단축키 목록 묶음 — 설정 화면은 React에서 useMessages()의 단축키 문구를, 그 밖에서는 msg()를 넘긴다 */
export function shortcutGroups(s: ShortcutMessages = msg().screens.shortcuts): ShortcutGroup[] {
  return [
    { title: s.groups.app, items: appShortcuts(s) },
    { title: s.groups.edit, items: editShortcuts(s) },
    { title: s.groups.markdown, items: markdownShortcuts() },
  ];
}
