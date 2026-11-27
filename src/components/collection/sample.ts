/* i18n-ignore-file — 스토리·Debug용 샘플 데이터 */
import type { CustomProperty, PropertyEntry } from "./property-types";
import type { RecordItem } from "./fields";

/** 스토리·Debug용 레코드 — 실제 업무 노트처럼 */
export const SAMPLE_RECORDS: RecordItem[] = [
  {
    id: "r1",
    title: "스프린트 리뷰 준비",
    status: "진행 중",
    assignee: "차민석",
    due: { date: "2026-11-24", text: "11월 24일", late: false },
    tags: [{ name: "회의", color: "blue" }],
  },
  {
    id: "r2",
    title: "온보딩 문서 개편",
    status: "검토",
    assignee: "이지후",
    due: { date: "2026-11-21", text: "11월 21일", late: false },
    tags: [{ name: "문서", color: "green" }],
  },
  {
    id: "r3",
    title: "접근성 점검 체크리스트",
    status: "할 일",
    due: { date: "2026-11-28", text: "11월 28일", late: false },
    tags: [{ name: "기획", color: "purple" }],
  },
  {
    id: "r4",
    title: "릴리스 노트 초안",
    status: "할 일",
    assignee: "박세연",
    due: { date: "2026-11-12", text: "11월 12일", late: true },
    tags: [],
  },
  { id: "r5", title: "", tags: [] },
  {
    id: "r6",
    title: "디자인 토큰 정리",
    status: "완료",
    assignee: "차민석",
    due: { date: "2026-11-03", text: "11월 3일", late: true },
    tags: [{ name: "디자인", color: "pink" }],
  },
];

export const SAMPLE_ASSIGNEES = ["박세연", "이지후", "차민석"];

/** 스토리·Debug용 사용자 속성 (COLL-08) */
export const SAMPLE_PROPERTIES: CustomProperty[] = [
  { id: "fbudget01", name: "예산", type: "number", options: [] },
  {
    id: "fstage001",
    name: "단계",
    type: "select",
    options: [
      { name: "초안", color: "gray" },
      { name: "검토 중", color: "yellow" },
      { name: "확정", color: "green" },
    ],
  },
  {
    id: "fteam0001",
    name: "관련 팀",
    type: "multi",
    options: [
      { name: "디자인", color: "purple" },
      { name: "개발", color: "blue" },
      { name: "운영", color: "orange" },
    ],
  },
  { id: "fcheck001", name: "검수 완료", type: "checkbox", options: [] },
  { id: "flink0001", name: "참고 링크", type: "url", options: [] },
  { id: "fmemo0001", name: "메모", type: "text", options: [] },
];

/** 속성 목록 — 기본 4개 + 사용자 속성 (메모는 숨김) */
export const SAMPLE_ENTRIES: PropertyEntry[] = [
  { key: "status", name: "상태", kind: "status", builtin: true, hidden: false, card: false },
  { key: "assignee", name: "담당", kind: "assignee", builtin: true, hidden: false, card: true },
  { key: "due", name: "마감", kind: "due", builtin: true, hidden: false, card: true },
  { key: "tags", name: "태그", kind: "tags", builtin: true, hidden: false, card: true },
  ...SAMPLE_PROPERTIES.map((p) => ({
    key: p.id,
    name: p.name,
    kind: p.type,
    builtin: false,
    hidden: p.id === "fmemo0001",
    card: p.id === "fstage001",
  })),
];
