import { SLASH_ITEMS } from "@/components/editor/slash-items";

/**
 * 단축키 목록 (SET-05) — 설정 → 단축키에 그대로 보인다.
 * 단축키를 더하거나 바꾸면 여기도 같이 고친다(앱: main-screen.tsx·command-palette.tsx, 에디터: extensions.ts·floating-toolbar.tsx).
 */
export type Shortcut = { name: string; keys: string[] };
export type ShortcutGroup = { title: string; items: Shortcut[] };

const APP: Shortcut[] = [
  { name: "명령 팔레트", keys: ["⌘", "K"] },
  { name: "새 페이지", keys: ["⌘", "N"] },
  { name: "빠른 메모", keys: ["⌘", "⇧", "N"] },
  { name: "오늘의 일일 노트", keys: ["⌥", "⌘", "T"] },
  { name: "템플릿", keys: ["⌘", "⇧", "T"] },
  { name: "새 탭", keys: ["⌘", "T"] },
  { name: "탭 닫기", keys: ["⌘", "W"] },
  { name: "다음 · 이전 탭", keys: ["⌃", "Tab"] },
  { name: "n번째 탭 (9는 마지막)", keys: ["⌘", "1–9"] },
  { name: "페이지 복제", keys: ["⌘", "D"] },
  { name: "설정", keys: ["⌘", ","] },
  { name: "사이드바 접기·펼치기", keys: ["⌘", "\\"] },
  { name: "집중 모드", keys: ["⌘", "."] },
  { name: "목차", keys: ["⌥", "⌘", "O"] },
  { name: "오른쪽 패널에 열기 (⌥⌘ 클릭 · 본문 링크 위에서 ⌥⌘↵)", keys: ["⌥", "⌘", "↵"] },
  { name: "오른쪽 패널 닫기", keys: ["⌥", "⌘", "W"] },
  { name: "화면 확대 · 축소", keys: ["⌘", "+ / −"] },
  { name: "화면 실제 크기", keys: ["⌘", "0"] },
];

const EDIT: Shortcut[] = [
  { name: "굵게", keys: ["⌘", "B"] },
  { name: "기울임", keys: ["⌘", "I"] },
  { name: "밑줄", keys: ["⌘", "U"] },
  { name: "취소선", keys: ["⌘", "⇧", "S"] },
  { name: "인라인 코드", keys: ["⌘", "E"] },
  { name: "링크", keys: ["⌘", "⇧", "K"] },
  { name: "하이라이트", keys: ["⌘", "⇧", "H"] },
  { name: "위 첨자", keys: ["⌘", "⇧", "."] },
  { name: "아래 첨자", keys: ["⌘", "⇧", ","] },
  { name: "블록 위로 옮기기", keys: ["⌘", "⇧", "↑"] },
  { name: "블록 아래로 옮기기", keys: ["⌘", "⇧", "↓"] },
  { name: "실행 취소", keys: ["⌘", "Z"] },
  { name: "다시 실행", keys: ["⌘", "⇧", "Z"] },
  { name: "블록 메뉴", keys: ["/"] },
  { name: "블록 핸들 메뉴 (＋ · ⋮⋮)", keys: ["⌘", "/"] },
  { name: "들여쓰기 · 내어쓰기", keys: ["Tab", "⇧Tab"] },
  { name: "본문에서 나가기", keys: ["Esc", "Tab"] },
  { name: "표 도구 모음으로 (표 안에서)", keys: ["⌥", "F10"] },
  { name: "서식 바로 (글자를 고른 뒤)", keys: ["⌥", "F10"] },
  { name: "페이지에서 찾기", keys: ["⌘", "F"] },
  { name: "찾아 바꾸기", keys: ["⌥", "⌘", "F"] },
];

/** 마크다운 단축 입력은 슬래시 메뉴 항목의 힌트에서 가져온다(한 곳에서만 고치게) */
const MARKDOWN: Shortcut[] = SLASH_ITEMS.filter((i) => i.hint).map((i) => ({
  name: i.title,
  keys: [i.hint!],
}));

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  { title: "앱", items: APP },
  { title: "편집", items: EDIT },
  { title: "마크다운 입력 (줄 맨 앞에서)", items: MARKDOWN },
];
