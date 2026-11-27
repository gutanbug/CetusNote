/**
 * 다른 앱에서 가져오기(DATA-11)의 앱별 안내 — 단일 원천.
 * 대화상자(import-app-dialog)가 이 데이터를 그리고, docs/product/import-guide.md가 같은 내용을 적는다.
 * 메뉴 이름은 공식 문서로 확인한 것만 적고, 확인하지 못한 것은 note에 「버전에 따라 다를 수 있어요」로 둔다.
 * 확인 기록(2026-11-23): Notion 공식 도움말(export-your-content)·Obsidian 도움말(vault)은 확인함.
 * AFFiNE은 공식 블로그(Markdown 내보내기 안내)로 경로를 확인했고, AppFlowy는 공식 문서에 닿지 못해 커뮤니티 자료로만 확인했다(아래 note 참고).
 * 문구(hint·gets·misses·steps·note)는 features.import.guides에 있고, getter로 읽을 때의 언어로 나온다(SYS-14).
 */
import { msg } from "@/lib/i18n";

export type ImportKind = "folder" | "zip" | "enex";

export type ImportGuide = {
  id: "notion" | "obsidian" | "appflowy" | "affine" | "evernote";
  label: string;
  /** 앱 고르기 카드의 한 줄: 무엇을 읽는지 */
  hint: string;
  /** 내보낸 것 중 가져오는 것 */
  gets: string[];
  /** 가져오지 않는 것 */
  misses: string[];
  /** 준비 단계. 메뉴 경로는 「」로 감싼다 */
  steps: string[];
  /**
   * 고를 수 있는 방식. 첫 번째가 주 버튼이며, 그 앱의 권장 내보내기 형식이다
   * (import-app-dialog가 kinds[0]을 주 버튼으로 쓴다).
   */
  kinds: ImportKind[];
  /** 메뉴 이름 확인 상태 등 짧은 주의 */
  note?: string;
};

/** 선택 목록 순서. 문구는 getter라서 읽는 순간의 언어로 나온다 */
export const IMPORT_GUIDES: ImportGuide[] = [
  {
    id: "notion",
    label: "Notion",
    get hint() {
      return msg().features.import.guides.notion.hint;
    },
    get gets() {
      return msg().features.import.guides.notion.gets;
    },
    get misses() {
      return msg().features.import.guides.notion.misses;
    },
    get steps() {
      return msg().features.import.guides.notion.steps;
    },
    kinds: ["zip"],
    get note() {
      return msg().features.import.guides.notion.note;
    },
  },
  {
    id: "obsidian",
    label: "Obsidian",
    get hint() {
      return msg().features.import.guides.obsidian.hint;
    },
    get gets() {
      return msg().features.import.guides.obsidian.gets;
    },
    get misses() {
      return msg().features.import.guides.obsidian.misses;
    },
    get steps() {
      return msg().features.import.guides.obsidian.steps;
    },
    kinds: ["folder", "zip"],
  },
  {
    id: "appflowy",
    label: "AppFlowy",
    get hint() {
      return msg().features.import.guides.appflowy.hint;
    },
    get gets() {
      return msg().features.import.guides.appflowy.gets;
    },
    get misses() {
      return msg().features.import.guides.appflowy.misses;
    },
    get steps() {
      return msg().features.import.guides.appflowy.steps;
    },
    kinds: ["folder", "zip"],
    get note() {
      return msg().features.import.guides.appflowy.note;
    },
  },
  {
    id: "affine",
    label: "AFFiNE",
    get hint() {
      return msg().features.import.guides.affine.hint;
    },
    get gets() {
      return msg().features.import.guides.affine.gets;
    },
    get misses() {
      return msg().features.import.guides.affine.misses;
    },
    get steps() {
      return msg().features.import.guides.affine.steps;
    },
    kinds: ["folder", "zip"],
    get note() {
      return msg().features.import.guides.affine.note;
    },
  },
  {
    id: "evernote",
    label: "Evernote",
    get hint() {
      return msg().features.import.guides.evernote.hint;
    },
    get gets() {
      return msg().features.import.guides.evernote.gets;
    },
    get misses() {
      return msg().features.import.guides.evernote.misses;
    },
    get steps() {
      return msg().features.import.guides.evernote.steps;
    },
    kinds: ["enex"],
    get note() {
      return msg().features.import.guides.evernote.note;
    },
  },
];

export function guideFor(id: ImportGuide["id"]): ImportGuide {
  return IMPORT_GUIDES.find((g) => g.id === id)!;
}
