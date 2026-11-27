/** 한국어 문구 — collection 영역 (SYS-14). 영어는 ../en/collection.ts에 같은 키로 둔다 */
export const collection = {
  model: {
    builtin: { status: "상태", assignee: "담당", due: "마감", tags: "태그" },
    fieldType: {
      text: "텍스트",
      number: "숫자",
      select: "선택",
      multi: "다중 선택",
      date: "날짜",
      checkbox: "체크박스",
      url: "URL",
      email: "이메일",
      phone: "전화번호",
      created: "만든 날짜",
      updated: "고친 날짜",
    },
    sort: {
      title: "제목",
      status: "상태",
      assignee: "담당",
      due: "마감",
      tags: "태그",
      updated: "수정일",
    },
    noneLabel: { status: "상태 없음", assignee: "담당 없음", tags: "태그 없음" },
    checked: "체크됨",
    unchecked: "체크 안 됨",
    unnamedField: "속성",
    /** 새 상태 이름 — 겹치면 번호를 붙인다 */
    newStatus: (n?: number) => (n ? `새 상태 ${n}` : "새 상태"),
    count: (n: number) => `${n}개`,
    dueCount: (n: number) => `마감 ${n}개`,
    lateCount: (n: number) => `지남 ${n}개`,
    /** 날짜·시각 글 (지역 시간) */
    stamp: (p: { y: number; m: number; d: number; hh: string; mm: string }) =>
      `${p.y}년 ${p.m}월 ${p.d}일 ${p.hh}:${p.mm}`,
    /** 마감일 글. 올해면 연도를 뺀다 */
    due: (p: { y: number | null; m: number; d: number }) =>
      `${p.y === null ? "" : `${p.y}년 `}${p.m}월 ${p.d}일`,
  },
};
