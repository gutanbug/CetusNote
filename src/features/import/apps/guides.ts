/**
 * 다른 앱에서 가져오기(DATA-11)의 앱별 안내 — 단일 원천.
 * 대화상자(import-app-dialog)가 이 데이터를 그리고, docs/product/import-guide.md가 같은 내용을 적는다.
 * 메뉴 이름은 공식 문서로 확인한 것만 적고, 확인하지 못한 것은 note에 「버전에 따라 다를 수 있어요」로 둔다.
 * 확인 기록(2026-11-23): Notion 공식 도움말(export-your-content)·Obsidian 도움말(vault)은 확인함.
 * AFFiNE은 공식 블로그(Markdown 내보내기 안내)로 경로를 확인했고, AppFlowy는 공식 문서에 닿지 못해 커뮤니티 자료로만 확인했다(아래 note 참고).
 */

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

/** 선택 목록 순서 */
export const IMPORT_GUIDES: ImportGuide[] = [
  {
    id: "notion",
    label: "Notion",
    hint: "Markdown & CSV 내보내기 zip",
    gets: [
      "페이지 본문(제목·목록·표·코드·그림)과 하위 페이지 구조",
      "데이터베이스(CSV)는 컬렉션으로 옮겨요",
    ],
    misses: ["관계·수식·롤업 열(값으로 옮기지 않아요)", "댓글과 버전 기록"],
    steps: [
      "가져올 최상위 페이지를 열고 오른쪽 위 •••(더보기)를 눌러요.",
      "•••에서 「More」를 열고 「Export」를 눌러요.",
      "형식에서 「Markdown & CSV」를 고르고, 「하위 페이지 포함(Include subpages)」을 켜요.",
      "「내보내기」를 누르면 받는 zip 파일을 그대로 골라요. 압축은 풀지 마세요.",
    ],
    kinds: ["zip"],
    note: "워크스페이스 전체는 설정 → 일반 → 「Export all workspace content」로 받을 수 있어요. 준비에 시간이 걸리고, 메일로 받는 링크는 7일 뒤 만료돼요.",
  },
  {
    id: "obsidian",
    label: "Obsidian",
    hint: "보관소(vault) 폴더 또는 zip",
    gets: [
      "노트(.md)와 front matter(title·tags·aliases), #태그",
      "위키링크·별칭·그림(![[그림]]), 콜아웃(> [!종류])",
    ],
    misses: ["캔버스(.canvas)와 플러그인 데이터", "보관소 밖에 있는 그림"],
    steps: [
      "내보낼 필요는 없어요. 노트는 보관소 폴더에 그대로 있어요.",
      "「폴더」를 누르고 보관소 폴더를 골라요. 안의 .obsidian 폴더는 건너뛰어요.",
      "보관소를 zip으로 압축했다면 「zip 파일」을 골라요.",
    ],
    kinds: ["folder", "zip"],
  },
  {
    id: "appflowy",
    label: "AppFlowy",
    hint: "Markdown 또는 HTML로 내보낸 파일과 폴더",
    gets: [
      "Markdown·HTML 문서와 하위 문서 구조",
      "그림(문서 기준 상대 경로), CSV 데이터베이스(컬렉션)",
    ],
    misses: ["AppFlowy 작업공간 내부 형식", "데이터베이스의 관계·수식·롤업 열"],
    steps: [
      "가져올 페이지마다 •••(더보기)를 눌러 「Export」에서 「Markdown」을 골라요. 데이터베이스는 「CSV」로 내보내요.",
      "받은 파일과 그림을 한 폴더에 모아 두세요. 그림은 문서 기준 상대 경로로 찾아요.",
      "「폴더」를 누르고 그 폴더를 골라요.",
    ],
    kinds: ["folder", "zip"],
    note: "AppFlowy 공식 도움말에는 닿지 못했어요. 커뮤니티 공지(forum.appflowy.com)에서 페이지별 Markdown·CSV 내보내기를 확인했어요(2026-11-23). 메뉴 이름은 버전에 따라 다를 수 있어요.",
  },
  {
    id: "affine",
    label: "AFFiNE",
    hint: "Markdown으로 내보낸 파일과 폴더",
    gets: ["Markdown 문서와 그림(index.md와 assets 폴더)", "CSV 데이터베이스(컬렉션)"],
    misses: [
      "원본 파일(.affine·.bs.zip)과 문서 스냅샷 — Markdown으로 내보내 주세요",
      "화이트보드 내용",
    ],
    steps: [
      "문서 메뉴에서 「Markdown」 내보내기를 골라요. 공유 패널에도 같은 내보내기 메뉴가 있어요.",
      "가져올 문서마다 반복해서 받고, 한 폴더에 모아 두세요.",
      "「폴더」를 누르고 그 폴더를 골라요.",
    ],
    kinds: ["folder", "zip"],
    note: "AFFiNE 공식 블로그(v0.27.4 기준, 2026-10-09 확인)에서 문서 메뉴의 「Markdown」 내보내기를 확인했어요. 상위 「내보내기」 메뉴 이름은 그 글에서 확인하지 못했고, 메뉴 이름은 버전에 따라 다를 수 있어요.",
  },
  {
    id: "evernote",
    label: "Evernote",
    hint: "노트북마다 하나씩 만들어지는 ENEX 파일",
    gets: [
      "노트 본문(글꼴·목록·표·링크)과 체크 목록",
      "그림과 첨부 파일, 태그, 만든 날·고친 날. 파일 이름이 노트북 폴더가 돼요",
    ],
    misses: ["암호화된 노트(자리에 안내 글만 남겨요)", "원본이 없는 그림, 공유·댓글 정보"],
    steps: [
      "사이드바에서 가져올 노트북을 우클릭하고 「노트북 내보내기」를 골라요.",
      "형식에서 「ENEX」를 고르고 저장해요. 노트북마다 .enex 파일이 하나씩 생겨요.",
      "「ENEX 파일 고르기」를 누르고 받은 .enex 파일을 골라요. 여러 개를 한 번에 고를 수 있어요.",
    ],
    kinds: ["enex"],
    note: "메뉴 이름은 Evernote 버전에 따라 다를 수 있어요. 내보내기는 노트북 단위로만 돼요.",
  },
];

export function guideFor(id: ImportGuide["id"]): ImportGuide {
  return IMPORT_GUIDES.find((g) => g.id === id)!;
}
