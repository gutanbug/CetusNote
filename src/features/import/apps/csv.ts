import { msg } from "@/lib/i18n";
import type { FieldValue } from "@/lib/storage";

/**
 * 가져오기 CSV(데이터베이스) 처리 (DATA-11). 첫 열은 제목(Notion「Name」·AppFlowy 제목), 나머지 열은 속성.
 * 내보내기 CSV는 속성 종류를 적지 않으므로 값으로 짐작한다. 확실하지 않으면 글(text)로 둔다.
 */

export type ColumnType = "text" | "number" | "select" | "multi" | "date" | "checkbox";
/** 가져올 속성 한 열. options는 선택·다중 선택 옵션 이름(첫 등장 순서) */
export type Column = { name: string; type: ColumnType; options: string[] };

/** RFC 4180 CSV → 행 목록. BOM·CRLF·따옴표 안 줄바꿈을 다룬다. 빈 줄은 뺀다 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

const TRUE = /^(yes|true|체크|체크됨|✓|✔)$/i;
const FALSE = /^(no|false|체크 안 됨|)$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:$|[T ])/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;
const TAG_HEADER = /^(tags?|labels?|태그|라벨)$/i;

/** 열 목록을 짐작한다. header[0]은 제목 열이라 뺀다 */
export function inferColumns(header: string[], rows: string[][]): Column[] {
  return header.slice(1).map((raw, k) => {
    const i = k + 1;
    const name = raw.trim() || msg().features.import.propertyName(i);
    const values = rows.map((r) => (r[i] ?? "").trim());
    const filled = values.filter((v) => v !== "");
    const text: Column = { name, type: "text", options: [] };
    if (!filled.length) return text;
    if (
      filled.every((v) => TRUE.test(v) || FALSE.test(v)) &&
      filled.some((v) => TRUE.test(v) || /^(no|false)$/i.test(v))
    )
      return { name, type: "checkbox", options: [] };
    if (filled.every((v) => ISO_DATE.test(v))) return { name, type: "date", options: [] };
    if (filled.every((v) => NUMBER.test(v))) return { name, type: "number", options: [] };
    if (TAG_HEADER.test(name)) {
      const options = unique(filled.flatMap(splitTags));
      return { name, type: "multi", options };
    }
    const distinct = unique(filled);
    const short = distinct.every((v) => v.length <= 30 && !v.includes(","));
    if (short && distinct.length <= 8 && filled.length >= 3 && filled.length > distinct.length)
      return { name, type: "select", options: distinct };
    return text;
  });
}

/** 한 칸 → 속성 값. 비었거나 맞지 않으면 null */
export function cellValue(column: Column, raw: string | undefined): FieldValue | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  switch (column.type) {
    case "checkbox":
      return TRUE.test(v) ? true : null;
    case "number": {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "date":
      return ISO_DATE.test(v) ? v.slice(0, 10) : null;
    case "multi": {
      const tags = splitTags(v);
      return tags.length ? tags : null;
    }
    default:
      return v;
  }
}

function splitTags(v: string): string[] {
  return v
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
