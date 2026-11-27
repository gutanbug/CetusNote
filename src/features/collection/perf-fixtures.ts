/* i18n-ignore-file — 벤치마크 픽스처 데이터 */
import {
  createPage,
  DEFAULT_STATUSES,
  normalizeCollection,
  type CollectionSettings,
  type FieldDef,
  type Page,
} from "@/lib/storage";

/**
 * 큰 컬렉션 측정·스토리용 결정적 픽스처 (SYS-11). 기본 속성 4개 + 사용자 속성 7개(텍스트·숫자·선택·
 * 다중 선택·날짜·체크박스·링크)를 채운 레코드 n개를 만든다. 같은 n이면 항상 같은 데이터다.
 */
export const PERF_ASSIGNEES = ["박세연", "이지후", "차민석", "최유리", "정하준"];
export const PERF_TAGS = ["회의", "문서", "기획", "디자인", "개발", "운영"];
const TAG_COLORS: Record<string, string> = {
  회의: "blue",
  문서: "green",
  기획: "purple",
  디자인: "pink",
  개발: "orange",
  운영: "gray",
};

export const PERF_FIELDS: FieldDef[] = [
  { id: "fperftxt01", name: "메모", type: "text", options: [] },
  { id: "fperfnum01", name: "예산", type: "number", options: [] },
  {
    id: "fperfsel01",
    name: "단계",
    type: "select",
    options: [
      { name: "초안", color: "gray" },
      { name: "검토 중", color: "yellow" },
      { name: "확정", color: "green" },
    ],
  },
  {
    id: "fperfmul01",
    name: "관련 팀",
    type: "multi",
    options: [
      { name: "디자인", color: "purple" },
      { name: "개발", color: "blue" },
      { name: "운영", color: "orange" },
    ],
  },
  { id: "fperfdat01", name: "시작일", type: "date", options: [] },
  { id: "fperfchk01", name: "검수 완료", type: "checkbox", options: [] },
  { id: "fperfurl01", name: "참고 링크", type: "url", options: [] },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** 컬렉션 설정 — 보기·속성 순서를 기본값 위에 얹는다 */
export function perfSettings(view: CollectionSettings["view"] = "grid"): CollectionSettings {
  const base = normalizeCollection(null);
  return {
    ...base,
    view,
    statuses: DEFAULT_STATUSES.map((o) => ({ ...o })),
    fields: PERF_FIELDS.map((f) => ({ ...f, options: f.options.map((o) => ({ ...o })) })),
    properties: [
      { key: "status", hidden: false, card: false },
      { key: "assignee", hidden: false, card: true },
      { key: "due", hidden: false, card: true },
      { key: "tags", hidden: false, card: true },
      ...PERF_FIELDS.map((f) => ({ key: f.id, hidden: false, card: f.id === "fperfsel01" })),
    ],
  };
}

/**
 * 컬렉션 페이지 하나 + 레코드 n개 + 다른 곳의 페이지 `noise`개가 든 pages 맵.
 * 레코드는 pages 맵 안에 따로 있는 페이지다 (구조 변경 없이 props·values만 다르다).
 */
export function makePerfCollection(
  n: number,
  { noise = 200, view = "grid" as CollectionSettings["view"] } = {},
) {
  const collection: Page = createPage({ kind: "collection", title: `성능 측정 ${n}` });
  const settings = perfSettings(view);
  collection.collection = settings;
  const pages: Record<string, Page> = { [collection.id]: collection };
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < n; i++) {
    const due = new Date(base + (i % 400) * 86_400_000).toISOString().slice(0, 10);
    const tagA = PERF_TAGS[i % PERF_TAGS.length]!;
    const tagB = PERF_TAGS[(i * 7 + 3) % PERF_TAGS.length]!;
    const rec = createPage({
      title: `레코드 ${pad(i % 100)}-${i} 회의록 검토`,
      parentId: collection.id,
      props: {
        tags: tagA === tagB ? [tagA] : [tagA, tagB],
        status: DEFAULT_STATUSES[i % DEFAULT_STATUSES.length]!.name,
        assignee: i % 11 === 0 ? null : PERF_ASSIGNEES[i % PERF_ASSIGNEES.length]!,
        due: i % 9 === 0 ? null : due,
        values: {
          fperftxt01: `메모 ${i} 내용 조금`,
          fperfnum01: (i * 37) % 10_000,
          fperfsel01: ["초안", "검토 중", "확정"][i % 3]!,
          fperfmul01: i % 2 ? ["디자인", "개발"] : ["운영"],
          fperfdat01: due,
          fperfchk01: i % 4 === 0,
          fperfurl01: `https://example.com/doc/${i}`,
        },
      },
    });
    pages[rec.id] = rec;
  }
  for (let i = 0; i < noise; i++) {
    const p = createPage({ title: `다른 페이지 ${i}` });
    pages[p.id] = p;
  }
  return { collection, pages, settings, tagColors: TAG_COLORS };
}
