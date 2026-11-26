import type { FieldDef, Page } from "@/lib/storage";

/**
 * 컬렉션 CSV 내보내기 (DATA-13). 레코드 한 줄, 머리글은 속성 이름.
 * 엑셀이 한글을 읽도록 UTF-8 BOM을 붙이고, 줄바꿈은 RFC 4180대로 CRLF로 쓴다.
 */

const BOM = "﻿";

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

/** 고정 열 다음에 컬렉션의 사용자 속성 열이 온다 */
export function collectionCsvHeader(collection: Page): string[] {
  const fields = collection.collection?.fields ?? [];
  return ["제목", "상태", "담당", "마감", "태그", ...fields.map((f) => f.name)];
}

/** 컬렉션 레코드를 CSV 텍스트(UTF-8 BOM 포함)로 바꾼다. 순수 함수 */
export function collectionToCsv(collection: Page, records: readonly Page[]): string {
  const fields = collection.collection?.fields ?? [];
  const rows = records.map((r) => [
    r.title.trim() || "제목 없음",
    r.props.status ?? "",
    r.props.assignee ?? "",
    r.props.due ?? "",
    r.props.tags.join(", "),
    ...fields.map((f) => fieldText(f, r)),
  ]);
  return (
    BOM +
    [collectionCsvHeader(collection), ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
