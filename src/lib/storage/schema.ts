import type {
  CollectionFilter,
  CollectionSettings,
  CollectionSort,
  CollectionView,
  DocJSON,
  Page,
  PageFont,
  PageKind,
  PageTemplate,
  BoardCalc,
  BoardGroupBy,
  BoardSettings,
  BuiltinProperty,
  FieldDef,
  FieldId,
  FieldOption,
  FieldType,
  FieldValue,
  PropertySlot,
  RecordOpenMode,
  StatusOption,
  WorkspaceMeta,
} from "./types";
import { isValidId, ulid } from "./ulid";

export const PAGE_SCHEMA_VERSION = 6;
export const WORKSPACE_SCHEMA_VERSION = 1;

/** 기본 상태 4단계 — 일반 문서와 새 컬렉션이 쓴다 */
export const DEFAULT_STATUSES: readonly StatusOption[] = [
  { name: "할 일", color: "gray" },
  { name: "진행 중", color: "blue" },
  { name: "검토", color: "orange" },
  { name: "완료", color: "green" },
];
/** 소프트 컬러 이름 (UI-TagChip SOFT_COLORS와 같다) */
export const COLOR_NAMES = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;
const GROUP_BYS: readonly BoardGroupBy[] = ["status", "assignee", "tags"];
const CALCS: readonly BoardCalc[] = ["count", "due", "late", "none"];
/** 상태 이름 최대 길이 */
export const STATUS_MAX = 40;
const FONTS: readonly PageFont[] = ["default", "serif", "mono"];
const KINDS: readonly PageKind[] = ["page", "folder", "collection"];
const VIEWS: readonly CollectionView[] = ["grid", "board", "calendar"];
const SORT_FIELDS: readonly CollectionSort["field"][] = [
  "title",
  "status",
  "assignee",
  "due",
  "tags",
  "updated",
];
const FILTER_FIELDS: readonly string[] = ["status", "assignee", "tags"];
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/* ---------- 사용자 속성 (COLL-08, 스키마 5) ---------- */

/** 기본 속성 — 순서는 처음 보이는 순서 */
export const BUILTIN_PROPERTIES: readonly BuiltinProperty[] = ["status", "assignee", "due", "tags"];
export const FIELD_TYPES: readonly FieldType[] = [
  "text",
  "number",
  "select",
  "multi",
  "date",
  "checkbox",
  "url",
  "email",
  "phone",
  "created",
  "updated",
];
const OPEN_MODES: readonly RecordOpenMode[] = ["modal", "side", "tab"];
/** 사용자 속성 id — "f" + 소문자·숫자 */
const FIELD_ID = /^f[a-z0-9]{4,20}$/;
export const isFieldId = (v: unknown): v is FieldId => typeof v === "string" && FIELD_ID.test(v);
/** 속성·옵션 이름, 텍스트 값의 최대 길이 */
export const FIELD_NAME_MAX = 60;
export const FIELD_TEXT_MAX = 2000;
/** 한 컬렉션의 사용자 속성 최대 개수 */
export const FIELDS_MAX = 50;

const isColor = (c: unknown): c is string =>
  typeof c === "string" && (COLOR_NAMES as readonly string[]).includes(c);

function normalizeOptions(v: unknown): FieldOption[] {
  const out: FieldOption[] = [];
  if (!Array.isArray(v)) return out;
  for (const o of v) {
    if (!isObj(o) || typeof o.name !== "string") continue;
    const name = o.name.trim().slice(0, FIELD_NAME_MAX);
    if (!name || out.some((x) => x.name === name)) continue;
    out.push({ name, color: isColor(o.color) ? o.color : "gray" });
  }
  return out;
}

function normalizeFields(v: unknown): FieldDef[] {
  const out: FieldDef[] = [];
  if (!Array.isArray(v)) return out;
  for (const f of v) {
    if (out.length >= FIELDS_MAX) break;
    if (!isObj(f) || !isFieldId(f.id) || out.some((x) => x.id === f.id)) continue;
    const type = FIELD_TYPES.includes(f.type as FieldType) ? (f.type as FieldType) : "text";
    const name = typeof f.name === "string" ? f.name.trim().slice(0, FIELD_NAME_MAX) : "";
    out.push({
      id: f.id,
      name: name || "속성",
      type,
      options: type === "select" || type === "multi" ? normalizeOptions(f.options) : [],
    });
  }
  return out;
}

/** 속성 순서: 아는 키만, 한 번씩. 빠진 기본 속성·사용자 속성은 뒤에 보이게 붙인다 */
function normalizeProperties(v: unknown, fields: FieldDef[]): PropertySlot[] {
  const known = new Set<string>([...BUILTIN_PROPERTIES, ...fields.map((f) => f.id)]);
  const out: PropertySlot[] = [];
  if (Array.isArray(v))
    for (const s of v) {
      if (!isObj(s) || typeof s.key !== "string" || !known.has(s.key)) continue;
      if (out.some((x) => x.key === s.key)) continue;
      out.push({
        key: s.key as PropertySlot["key"],
        hidden: s.hidden === true,
        card: s.card === true,
      });
    }
  // 기본 속성은 예전처럼 카드에 담당·마감·태그가 보이게(상태는 보드 칸이 이미 보여 준다)
  for (const key of known)
    if (!out.some((x) => x.key === key))
      out.push({
        key: key as PropertySlot["key"],
        hidden: false,
        card: key === "assignee" || key === "due" || key === "tags",
      });
  return out;
}

/** 레코드 값: 사용자 속성 id 키만, 값 모양이 맞는 것만 (어느 종류인지는 부모 컬렉션이 안다) */
function normalizeValues(v: unknown): Record<FieldId, FieldValue> {
  const out: Record<FieldId, FieldValue> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    if (!isFieldId(k)) continue;
    if (typeof x === "string") {
      if (x) out[k] = x.slice(0, FIELD_TEXT_MAX);
    } else if (typeof x === "number") {
      if (Number.isFinite(x)) out[k] = x;
    } else if (typeof x === "boolean") out[k] = x;
    else if (Array.isArray(x)) {
      const list = strList(x).map((s) => s.slice(0, FIELD_NAME_MAX));
      if (list.length) out[k] = list;
    }
  }
  return out;
}

/** 컬렉션 보기 설정을 맞춘다. 모르는 값은 기본값으로 */
export function normalizeCollection(v: unknown): CollectionSettings {
  const raw = isObj(v) ? v : {};
  const sort = isObj(raw.sort) ? raw.sort : null;
  const filters: CollectionFilter[] = [];
  if (Array.isArray(raw.filters))
    for (const f of raw.filters) {
      if (!isObj(f) || typeof f.value !== "string" || !f.value) continue;
      const field = f.field as CollectionFilter["field"];
      if (!FILTER_FIELDS.includes(field) && !isFieldId(field)) continue;
      if (filters.some((x) => x.field === field && x.value === f.value)) continue;
      filters.push({ field, value: f.value });
    }
  // 상태 목록: 없으면(스키마 3 이하) 기본 4단계. 빈 목록은 사용자가 다 지운 것이라 그대로 둔다
  let statuses: StatusOption[] = DEFAULT_STATUSES.map((o) => ({ ...o }));
  if (Array.isArray(raw.statuses)) {
    statuses = [];
    for (const o of raw.statuses) {
      if (!isObj(o) || typeof o.name !== "string") continue;
      const name = o.name.trim().slice(0, STATUS_MAX);
      if (!name || statuses.some((x) => x.name === name)) continue;
      statuses.push({ name, color: isColor(o.color) ? o.color : "gray" });
    }
  }
  const b = isObj(raw.board) ? raw.board : {};
  const colors: Record<string, string> = {};
  if (isObj(b.colors)) for (const [k, c] of Object.entries(b.colors)) if (isColor(c)) colors[k] = c;
  const board: BoardSettings = {
    groupBy: GROUP_BYS.includes(b.groupBy as BoardGroupBy) ? (b.groupBy as BoardGroupBy) : "status",
    hidden: [...new Set(strList(b.hidden))],
    colors,
    calc: CALCS.includes(b.calc as BoardCalc) ? (b.calc as BoardCalc) : "count",
  };
  const fields = normalizeFields(raw.fields);
  return {
    statuses,
    board,
    fields,
    properties: normalizeProperties(raw.properties, fields),
    openMode: OPEN_MODES.includes(raw.openMode as RecordOpenMode)
      ? (raw.openMode as RecordOpenMode)
      : null,
    view: VIEWS.includes(raw.view as CollectionView) ? (raw.view as CollectionView) : "grid",
    sort:
      sort &&
      (SORT_FIELDS.includes(sort.field as CollectionSort["field"]) ||
        fields.some((f) => f.id === sort.field))
        ? {
            field: sort.field as CollectionSort["field"],
            dir: sort.dir === "desc" ? "desc" : "asc",
          }
        : null,
    // 지운 사용자 속성을 가리키는 필터는 버린다
    filters: filters.filter((f) => !isFieldId(f.field) || fields.some((x) => x.id === f.field)),
  };
}

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const strList = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x))] : [];

/**
 * 버전별 마이그레이션: key 버전에서 key+1 버전으로 바꾼다.
 * 형식을 바꿀 때 PAGE_SCHEMA_VERSION을 올리고 여기에 단계를 더한다.
 */
const PAGE_MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  // 2: 폴더(SHELL-14). 그전 파일은 모두 문서
  1: (raw) => ({ ...raw, kind: "page" }),
  // 3: 컬렉션(COLL-01) — 담당·마감 속성, kind "collection". 기존 파일은 그대로(빈 값으로 채움)
  2: (raw) => raw,
  // 4: 컬렉션마다 상태 목록·보드 설정, 상태는 자유 이름. 기존 값은 그대로(기본 4단계로 채움)
  3: (raw) => raw,
  // 5: 사용자 속성(COLL-08)·열기 방식(COLL-07). 기존 값은 그대로(속성 없음·기본 순서로 채움)
  4: (raw) => raw,
  // 6: 템플릿(PAGE-14) — template 필드. 기존 파일은 템플릿이 아니다(null)
  5: (raw) => raw,
};

const TEMPLATE_TEXT_MAX = 120;
function normalizeTemplate(v: unknown): PageTemplate | null {
  if (!isObj(v)) return null;
  const category = typeof v.category === "string" && v.category.trim() ? v.category.trim() : "work";
  return {
    category: category.slice(0, 40),
    description: str(v.description, "").slice(0, TEMPLATE_TEXT_MAX),
    pageTitle: str(v.pageTitle, "").slice(0, TEMPLATE_TEXT_MAX),
    builtin: typeof v.builtin === "string" && v.builtin ? v.builtin.slice(0, 40) : null,
  };
}

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

/**
 * 파일에서 읽은 페이지를 지금 형식으로 맞춘다. 빠진 값은 기본값으로 채우고 모르는 키는 버린다.
 * 앱보다 새 버전의 파일이면 SchemaError — 덮어써서 정보를 잃지 않게 열지 않는다.
 */
export function normalizePage(input: unknown): Page {
  if (!isObj(input)) throw new SchemaError("페이지가 객체가 아니에요");
  let raw = input;
  let version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1;
  if (version > PAGE_SCHEMA_VERSION)
    throw new SchemaError(`더 새 버전(${version})의 앱에서 만든 페이지예요`);
  while (version < PAGE_SCHEMA_VERSION) {
    const step = PAGE_MIGRATIONS[version];
    if (!step) throw new SchemaError(`버전 ${version} 마이그레이션이 없어요`);
    raw = step(raw);
    version++;
  }
  if (!isValidId(raw.id)) throw new SchemaError("페이지 id가 올바르지 않아요");

  const props = isObj(raw.props) ? raw.props : {};
  const layout = isObj(raw.layout) ? raw.layout : {};
  const now = new Date().toISOString();
  const createdAt = str(raw.createdAt, now);
  const kind = KINDS.includes(raw.kind as PageKind) ? (raw.kind as PageKind) : "page";
  const assignee = strOrNull(typeof props.assignee === "string" ? props.assignee.trim() : null);
  return {
    schemaVersion: PAGE_SCHEMA_VERSION,
    id: raw.id,
    kind,
    title: str(raw.title, ""),
    icon: strOrNull(raw.icon),
    cover: strOrNull(raw.cover),
    parentId: isValidId(raw.parentId) && raw.parentId !== raw.id ? raw.parentId : null,
    props: {
      tags: strList(props.tags),
      status:
        typeof props.status === "string" && props.status.trim()
          ? props.status.trim().slice(0, STATUS_MAX)
          : null,
      assignee: assignee ? assignee.slice(0, 80) : null,
      due: typeof props.due === "string" && DATE.test(props.due) ? props.due : null,
      values: normalizeValues(props.values),
    },
    collection: kind === "collection" ? normalizeCollection(raw.collection) : null,
    layout: {
      fullWidth: layout.fullWidth === true,
      font: FONTS.includes(layout.font as PageFont) ? (layout.font as PageFont) : "default",
    },
    content:
      isObj(raw.content) && raw.content.type === "doc"
        ? (raw.content as DocJSON)
        : { type: "doc", content: [] },
    createdAt,
    updatedAt: str(raw.updatedAt, createdAt),
    trashedAt: strOrNull(raw.trashedAt),
    // 템플릿은 문서만
    template: kind === "page" ? normalizeTemplate(raw.template) : null,
  };
}

export function normalizeWorkspace(input: unknown, fallbackName = "내 노트"): WorkspaceMeta {
  const raw = isObj(input) ? input : {};
  const version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1;
  if (version > WORKSPACE_SCHEMA_VERSION)
    throw new SchemaError(`더 새 버전(${version})의 앱에서 만든 워크스페이스예요`);
  const order: Record<string, string[]> = {};
  if (isObj(raw.order))
    for (const [key, ids] of Object.entries(raw.order)) {
      if (key === "root" || isValidId(key)) order[key] = strList(ids).filter(isValidId);
    }
  const tags: Record<string, string> = {};
  if (isObj(raw.tags))
    for (const [name, color] of Object.entries(raw.tags))
      if (name && typeof color === "string") tags[name] = color;
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    name: str(raw.name, "") || fallbackName,
    order,
    favorites: strList(raw.favorites).filter(isValidId),
    tags,
    quickNotes: Array.isArray(raw.quickNotes)
      ? raw.quickNotes.flatMap((n: unknown) => {
          if (!isObj(n) || typeof n.text !== "string" || !n.text.trim()) return [];
          const id = typeof n.id === "string" && isValidId(n.id) ? n.id : ulid();
          const createdAt =
            typeof n.createdAt === "string" ? n.createdAt : new Date(0).toISOString();
          return [{ id, text: n.text, createdAt }];
        })
      : [],
    templatesSeeded: raw.templatesSeeded === true,
  };
}

/**
 * parent 아래에 kind를 둘 수 있는가 (SHELL-14, COLL-01). 루트·폴더·문서 아래에는 무엇이든
 * (2026-11-20 사용자 요청), 컬렉션 아래에는 문서만(컬렉션의 자식 문서가 레코드).
 */
export function canContain(parent: Pick<Page, "kind"> | null | undefined, kind: PageKind): boolean {
  return !parent || parent.kind !== "collection" || kind === "page";
}

/** 새 페이지 (PAGE-01) · 새 폴더 (SHELL-14: kind "folder") */
export function createPage(
  init: Partial<
    Pick<Page, "kind" | "title" | "icon" | "parentId" | "content" | "props" | "template">
  > = {},
): Page {
  const now = new Date().toISOString();
  return normalizePage({
    schemaVersion: PAGE_SCHEMA_VERSION,
    id: ulid(),
    ...init,
    createdAt: now,
    updatedAt: now,
  });
}
