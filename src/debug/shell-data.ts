import type { WorkspaceRow } from "@/components/shell/workspace-switcher";
import type { PageNode } from "@/components/shell/page-tree";

// L3 셸 스토리의 견본 데이터

export const SAMPLE_PAGES: PageNode[] = [
  {
    id: "work",
    title: "업무",
    kind: "folder",
    children: [
      {
        id: "meetings",
        title: "회의록",
        emoji: "🗓️",
        children: [
          { id: "m-1118", title: "11월 18일 주간 회의", emoji: "📝" },
          { id: "m-1111", title: "11월 11일 주간 회의", emoji: "📝" },
        ],
      },
      { id: "roadmap", title: "2027 상반기 로드맵", emoji: "🧭" },
    ],
  },
  {
    id: "study",
    title: "공부",
    kind: "folder",
    children: [
      { id: "rust", title: "Rust 소유권 정리", emoji: "🦀" },
      { id: "untitled", title: "" },
    ],
  },
  { id: "reading", title: "읽고 싶은 책", emoji: "📖" },
  { id: "travel", title: "제주 여행 준비물 — 3박 4일, 렌터카, 우천 대비", emoji: "🏝️" },
];

export const SAMPLE_PATH = [
  { id: "work", title: "업무", emoji: "💼" },
  { id: "meetings", title: "회의록", emoji: "🗓️" },
  { id: "m-1118", title: "11월 18일 주간 회의", emoji: "📝" },
];

/** 긴 경로 — 브레드크럼 생략(…) 견본 */
export const LONG_PATH = [
  { id: "a", title: "업무", emoji: "💼" },
  { id: "b", title: "2026 프로젝트", emoji: "🗂️" },
  { id: "c", title: "CetusNote", emoji: "🐋" },
  { id: "d", title: "디자인", emoji: "🎨" },
  { id: "e", title: "회의록", emoji: "🗓️" },
  { id: "f", title: "11월 18일 디자인 리뷰 — 사이드바와 상단 바 정리", emoji: "📝" },
];

/** 워크스페이스 목록 견본 (SHELL-15) */
export const SAMPLE_WORKSPACES: WorkspaceRow[] = [
  { id: "a", name: "내 노트", detail: "페이지 24개 · ~/Documents/내 노트", current: true },
  { id: "b", name: "업무 노트", detail: "~/Documents/업무 노트" },
  { id: "c", name: "여행 준비", detail: "~/Library/Mobile Documents/여행 준비" },
];
