import {
  collectionRecords as orderedRecords,
  fieldOf,
  queryRecords,
} from "@/features/collection/model";
import type { BuiltinProperty, FieldDef, Page } from "@/lib/storage";

/**
 * 컬렉션 CSV 내보내기 (DATA-13). 레코드 한 줄, 머리글은 속성 이름.
 * 엑셀이 한글을 읽도록 UTF-8 BOM을 붙이고, 줄바꿈은 RFC 4180대로 CRLF로 쓴다.
 *
 * 범위 두 가지: "all"(전체 레코드, 고정 열 + 사용자 속성 전부, 제목 순),
 * "view"(지금 보기 그대로: 화면과 같은 순서·필터·정렬, 숨긴 속성 열은 뺀다. 검색어는 화면의 임시 상태라 따르지 않는다).
 */

const BOM = "﻿";

export type CsvScope = "all" | "view";

/** RFC 4180 셀: 쉼표·큰따옴표·줄바꿈이 있으면 큰따옴표로 감싸고, 안의 큰따옴표는 두 번 쓴다 */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const localDate = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** 속성 하나의 셀 값. 날짜는 지역 날짜, 불리언은 예/아니오 */
export function fieldText(def: FieldDef, page: Page): string {
  if (def.type === "created") return localDate(page.createdAt);
  if (def.type === "updated") return localDate(page.updatedAt);
  const v = page.props.values[def.id];
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

type CsvColumn = { header: string; cell: (r: Page) => string };

const TITLE_COLUMN: CsvColumn = {
  header: "제목",
  cell: (r) => r.title.trim() || "제목 없음",
};

const BUILTIN_COLUMNS: Record<BuiltinProperty, CsvColumn> = {
  status: { header: "상태", cell: (r) => r.props.status ?? "" },
  assignee: { header: "담당", cell: (r) => r.props.assignee ?? "" },
  due: { header: "마감", cell: (r) => r.props.due ?? "" },
  tags: { header: "태그", cell: (r) => r.props.tags.join(", ") },
};

const fieldColumn = (f: FieldDef): CsvColumn => ({
  header: f.name,
  cell: (r) => fieldText(f, r),
});

/** 열 목록. "all"은 고정 열 다음에 사용자 속성 전부, "view"는 속성 순서를 따르고 숨긴 열은 뺀다 */
function csvColumns(collection: Page, scope: CsvScope): CsvColumn[] {
  const fields = collection.collection?.fields ?? [];
  if (scope === "all") {
    return [
      TITLE_COLUMN,
      BUILTIN_COLUMNS.status,
      BUILTIN_COLUMNS.assignee,
      BUILTIN_COLUMNS.due,
      BUILTIN_COLUMNS.tags,
      ...fields.map(fieldColumn),
    ];
  }
  const slots = collection.collection?.properties ?? [];
  const cols: CsvColumn[] = [TITLE_COLUMN];
  const seen = new Set<string>();
  for (const slot of slots) {
    seen.add(slot.key);
    if (slot.hidden) continue;
    if (slot.key in BUILTIN_COLUMNS) {
      cols.push(BUILTIN_COLUMNS[slot.key as BuiltinProperty]);
      continue;
    }
    const def = fieldOf(fields, slot.key);
    if (def) cols.push(fieldColumn(def));
  }
  // 순서 목록에 없는 사용자 속성은 숨기지 않고 뒤에 붙인다(데이터가 조용히 빠지지 않게)
  for (const f of fields) if (!seen.has(f.id)) cols.push(fieldColumn(f));
  return cols;
}

/** 고정 열 다음에 컬렉션의 사용자 속성 열이 온다 */
export function collectionCsvHeader(collection: Page, scope: CsvScope = "all"): string[] {
  return csvColumns(collection, scope).map((c) => c.header);
}

/**
 * 컬렉션의 레코드(컬렉션 바로 아래 글, 휴지통 제외)를 제목 순으로 고른다. 순수 함수.
 * 범위 "all"용이다. 지금 보기는 viewRecords를 쓴다.
 */
export function collectionRecords(
  collectionId: string,
  all: Readonly<Record<string, Page>>,
): Page[] {
  return Object.values(all)
    .filter((p) => p.kind === "page" && p.parentId === collectionId && !p.trashedAt)
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "ko"));
}

/**
 * 지금 보기의 레코드: 화면과 같은 순서(order) → 필터 → 정렬. 검색어는 따르지 않는다. 순수 함수.
 */
export function viewRecords(
  collection: Page,
  all: Readonly<Record<string, Page>>,
  order: string[] = [],
): Page[] {
  const base = orderedRecords(all as Record<string, Page>, collection.id, order);
  const s = collection.collection;
  if (!s) return base;
  return queryRecords(base, {
    sort: s.sort,
    filters: s.filters,
    statuses: s.statuses,
    fields: s.fields,
  });
}

/** 컬렉션 레코드를 CSV 텍스트(UTF-8 BOM 포함)로 바꾼다. 순수 함수 */
export function collectionToCsv(
  collection: Page,
  records: readonly Page[],
  scope: CsvScope = "all",
): string {
  const cols = csvColumns(collection, scope);
  const rows = records.map((r) => cols.map((c) => c.cell(r)));
  return (
    BOM +
    [cols.map((c) => c.header), ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
