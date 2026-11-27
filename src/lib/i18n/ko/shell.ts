/** 한국어 문구 — shell 영역 (SYS-14). 영어는 ../en/shell.ts에 같은 키로 둔다 */
export const shell = {
  untitled: { page: "제목 없음", folder: "이름 없는 폴더", collection: "이름 없는 컬렉션" },
  breadcrumb: {
    label: "경로",
    hidden: (n: number) => `숨긴 경로 ${n}개`,
  },
  tabs: { label: "열린 탭", newTab: "새 탭" },
  tree: {
    label: "페이지 목록",
    more: (name: string) => `${name} 더보기`,
    addTo: (name: string) => `${name}에 추가`,
    addPageTo: (name: string) => `${name}에 페이지 추가`,
    addSubpage: (name: string) => `${name} 하위 페이지 추가`,
  },
  resizer: {
    label: "사이드바 너비 조절",
    valueText: (px: number) => `${px}픽셀`,
  },
  saveStatus: {
    saved: "모든 변경사항 저장됨",
    saving: "저장 중…",
    error: "저장하지 못했어요",
    retry: "다시 시도",
  },
  sidebar: { label: "사이드바", trash: "휴지통" },
  tag: {
    pageCount: (n: number) => `페이지 ${n}개`,
    menu: (name: string) => `${name} 태그 메뉴`,
  },
  topBar: {
    sidebar: "사이드바",
    outline: "목차",
    favorite: "즐겨찾기",
    focus: "집중 모드",
    pageMenu: "페이지 메뉴",
  },
  workspace: {
    current: "워크스페이스: ",
    title: "워크스페이스",
    remove: "목록에서 빼기",
    openNow: ", 지금 열림",
    newWorkspace: "새 워크스페이스…",
    openFolder: "다른 폴더 열기…",
    openFolderDetail: "이미 있는 노트 폴더를 워크스페이스로",
  },
};
