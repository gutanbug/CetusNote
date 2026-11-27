import {
  COLOR_NAMES,
  DEFAULT_STATUSES,
  FIELD_NAME_MAX,
  FIELDS_MAX,
  isFieldId,
  type BoardCalc,
  type BoardGroupBy,
  type BuiltinProperty,
  type CollectionFilter,
  type CollectionSettings,
  type CollectionSort,
  type FieldDef,
  type FieldId,
  type FieldOption,
  type FieldType,
  type FieldValue,
  type Page,
  type PropertySlot,
  type StatusOption,
} from "@/lib/storage";
import { intlLocale, msg } from "@/lib/i18n";

/**
 * 컬렉션 (COLL-01~06, 2026-11-20 사용자 결정): 컬렉션은 kind "collection"인 페이지, 레코드는 그 아래 문서.
 * 여기는 순수 계산만 둔다(정렬·필터·보드 칸·달력 칸·체크리스트 진행률).
 */

/** 컬렉션의 상태 목록 (스키마 3 이하 파일·컬렉션이 아닌 페이지는 기본 4단계) */
export const statusesOf = (page: Pick<Page, "collection"> | null | undefined): StatusOption[] =>
  page?.collection?.statuses ?? DEFAULT_STATUSES.map((o) => ({ ...o }));

/** 휴지통 밖 레코드. 순서: workspace.json order[컬렉션 id] → 나머지는 만든 순 */
export function collectionRecords(
  pages: Record<string, Page>,
  collectionId: string,
  order: string[] = [],
): Page[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return Object.values(pages)
    .filter((p) => p.parentId === collectionId && p.kind === "page" && !p.trashedAt)
    .sort(
      (a, b) =>
        (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

/* ---------- 속성 (COLL-08) ---------- */

/** 이름 표를 만든다. 값은 읽는 순간의 언어로 정해진다 (getter) */
function lazyNames<K extends string>(
  keys: readonly K[],
  read: (k: K) => string,
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of keys) Object.defineProperty(out, k, { get: () => read(k), enumerable: true });
  return out;
}

const BUILTIN_KEYS: readonly BuiltinProperty[] = ["status", "assignee", "due", "tags"];
const FIELD_TYPE_KEYS: readonly FieldType[] = [
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
const SORT_KEYS: readonly Exclude<CollectionSort["field"], FieldId>[] = [
  "title",
  "status",
  "assignee",
  "due",
  "tags",
  "updated",
];
const NONE_KEYS: readonly BoardGroupBy[] = ["status", "assignee", "tags"];

export const BUILTIN_NAMES = lazyNames(BUILTIN_KEYS, (k) => msg().collection.model.builtin[k]);
export const FIELD_TYPE_NAMES = lazyNames(
  FIELD_TYPE_KEYS,
  (k) => msg().collection.model.fieldType[k],
);

/** 필터 칩으로 거를 수 있는 사용자 속성 종류 */
export const FILTERABLE: readonly FieldType[] = ["select", "multi", "checkbox"];
/** 검색에 들어가는 사용자 속성 종류 */
const SEARCHABLE: readonly FieldType[] = ["text", "url", "email", "phone", "select", "multi"];

/** 사용자 속성 정의 찾기 */
export const fieldOf = (fields: FieldDef[], id: string): FieldDef | undefined =>
  fields.find((f) => f.id === id);

/** 레코드의 값. 자동 값(만든·고친 날짜)은 페이지 시각, 체크박스는 없으면 false */
export function valueOf(page: Page, field: FieldDef): FieldValue | null {
  if (field.type === "created") return page.createdAt;
  if (field.type === "updated") return page.updatedAt;
  const v = page.props.values[field.id];
  if (field.type === "checkbox") return v === true;
  return v ?? null;
}

/** ISO 시각 → "2026년 11월 20일 14:05" (지역 시간) */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return msg().collection.model.stamp({
    y: d.getFullYear(),
    m: d.getMonth() + 1,
    d: d.getDate(),
    hh: pad(d.getHours()),
    mm: pad(d.getMinutes()),
  });
}

/** 값을 글로 — 보드 카드·검색·접근성 이름에 쓴다. 비면 "" */
export function fieldText(field: FieldDef, value: FieldValue | null, today?: string): string {
  if (value === null || value === "") return "";
  switch (field.type) {
    case "number":
      return typeof value === "number" ? value.toLocaleString(intlLocale()) : "";
    case "checkbox":
      return value === true ? msg().collection.model.checked : "";
    case "multi":
      return Array.isArray(value) ? value.join(", ") : "";
    case "date":
      return typeof value === "string" ? formatDue(value, today).text : "";
    case "created":
    case "updated":
      return typeof value === "string" ? formatStamp(value) : "";
    default:
      return typeof value === "string" ? value : "";
  }
}

/** 새 속성 id — "f" + 무작위 소문자·숫자 */
export function newFieldId(taken: Iterable<string> = []): FieldId {
  const used = new Set(taken);
  for (;;) {
    const id = `f${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}` as FieldId;
    if (isFieldId(id) && !used.has(id)) return id;
  }
}

/** 새 속성 이름 — 종류 이름, 겹치면 "텍스트 2" … */
export function newFieldName(fields: FieldDef[], type: FieldType): string {
  const base = FIELD_TYPE_NAMES[type];
  const names = new Set([...fields.map((f) => f.name), ...Object.values(BUILTIN_NAMES)]);
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** 속성 하나 더하기 — 순서 맨 끝에 보이게. 최대 개수를 넘으면 null */
export function addField(
  settings: CollectionSettings,
  type: FieldType,
): { patch: Pick<CollectionSettings, "fields" | "properties">; id: FieldId } | null {
  if (settings.fields.length >= FIELDS_MAX) return null;
  const id = newFieldId(settings.fields.map((f) => f.id));
  const field: FieldDef = { id, name: newFieldName(settings.fields, type), type, options: [] };
  return {
    id,
    patch: {
      fields: [...settings.fields, field],
      properties: [...settings.properties, { key: id, hidden: false, card: false }],
    },
  };
}

/** 속성 이름 바꾸기 — 빈 이름이나 다른 속성과 같은 이름이면 null */
export function renameField(
  settings: CollectionSettings,
  id: FieldId,
  name: string,
): Pick<CollectionSettings, "fields"> | null {
  const next = name.trim().slice(0, FIELD_NAME_MAX);
  const taken = new Set([
    ...settings.fields.filter((f) => f.id !== id).map((f) => f.name),
    ...Object.values(BUILTIN_NAMES),
  ]);
  if (!next || taken.has(next)) return null;
  return { fields: settings.fields.map((f) => (f.id === id ? { ...f, name: next } : f)) };
}

/** 속성 지우기 — 정의·순서·그 속성의 필터·정렬을 함께 뺀다(레코드 값은 다음 저장 때 남아도 쓰지 않는다) */
export function deleteField(
  settings: CollectionSettings,
  id: FieldId,
): Pick<CollectionSettings, "fields" | "properties" | "filters" | "sort"> {
  return {
    fields: settings.fields.filter((f) => f.id !== id),
    properties: settings.properties.filter((p) => p.key !== id),
    filters: settings.filters.filter((f) => f.field !== id),
    sort: settings.sort?.field === id ? null : settings.sort,
  };
}

/** 선택 옵션 바꾸기 */
export function setFieldOptions(
  settings: CollectionSettings,
  id: FieldId,
  options: FieldOption[],
): Pick<CollectionSettings, "fields"> {
  return { fields: settings.fields.map((f) => (f.id === id ? { ...f, options } : f)) };
}

/** 속성 숨기기·카드 표시 바꾸기 */
export function setPropertySlot(
  settings: CollectionSettings,
  key: PropertySlot["key"],
  patch: Partial<Pick<PropertySlot, "hidden" | "card">>,
): Pick<CollectionSettings, "properties"> {
  return {
    properties: settings.properties.map((p) => (p.key === key ? { ...p, ...patch } : p)),
  };
}

/** 속성 순서 옮기기 — 보이는 속성끼리 한 칸 */
export function moveProperty(
  settings: CollectionSettings,
  key: PropertySlot["key"],
  dir: -1 | 1,
): Pick<CollectionSettings, "properties"> | null {
  const list = settings.properties;
  const i = list.findIndex((p) => p.key === key);
  if (i < 0) return null;
  let j = i + dir;
  while (j >= 0 && j < list.length && list[j]!.hidden) j += dir;
  if (j < 0 || j >= list.length) return null;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return { properties: next };
}

/** 선택 옵션 이름을 바꾸거나 지울 때 레코드 값도 고친다 — 고칠 레코드와 새 값 */
export function remapOption(
  records: Page[],
  field: FieldDef,
  from: string,
  to: string | null,
): { id: string; value: FieldValue | null }[] {
  const out: { id: string; value: FieldValue | null }[] = [];
  for (const r of records) {
    const v = r.props.values[field.id];
    if (field.type === "select" && v === from) out.push({ id: r.id, value: to });
    if (field.type === "multi" && Array.isArray(v) && v.includes(from)) {
      const list = v.flatMap((x) => (x === from ? (to && !v.includes(to) ? [to] : []) : [x]));
      out.push({ id: r.id, value: list.length ? list : null });
    }
  }
  return out;
}

/** 레코드 값 고치기 — props 전체(빈 값이면 키를 뺀다) */
export function withValue(
  props: Page["props"],
  id: FieldId,
  value: FieldValue | null,
): Page["props"] {
  const values = { ...props.values };
  const empty =
    value === null || value === "" || value === false || (Array.isArray(value) && !value.length);
  if (empty) delete values[id];
  else values[id] = value;
  return { ...props, values };
}

/** 필터 칩 이름 — 사용자 속성은 정의의 이름, 체크박스는 "체크됨/체크 안 됨" */
export const filterLabel = (f: CollectionFilter, fields: FieldDef[] = []) => {
  const m = msg().collection.model;
  if (!isFieldId(f.field)) return `${BUILTIN_NAMES[f.field as BuiltinProperty]}: ${f.value}`;
  const def = fieldOf(fields, f.field);
  const value = def?.type === "checkbox" ? (f.value === "true" ? m.checked : m.unchecked) : f.value;
  return `${def?.name ?? m.unnamedField}: ${value}`;
};

export const SORT_NAMES = lazyNames(SORT_KEYS, (k) => msg().collection.model.sort[k]);

function matches(p: Page, filters: CollectionFilter[], fields: FieldDef[]): boolean {
  const by = new Map<CollectionFilter["field"], string[]>();
  for (const f of filters) by.set(f.field, [...(by.get(f.field) ?? []), f.value]);
  for (const [field, values] of by) {
    let ok: boolean;
    if (isFieldId(field)) {
      const def = fieldOf(fields, field);
      const v = def ? valueOf(p, def) : null;
      ok =
        def?.type === "checkbox"
          ? values.includes(String(v === true))
          : Array.isArray(v)
            ? v.some((x) => values.includes(x))
            : typeof v === "string" && values.includes(v);
    } else
      ok =
        field === "status"
          ? values.includes(p.props.status ?? "")
          : field === "assignee"
            ? values.includes(p.props.assignee ?? "")
            : p.props.tags.some((t) => values.includes(t));
    if (!ok) return false;
  }
  return true;
}

/** 비교 키. 빈 값은 방향과 관계없이 늘 뒤로 간다 */
function key(
  p: Page,
  field: CollectionSort["field"],
  statusRank?: Map<string, number>,
  fields: FieldDef[] = [],
): string | number | null {
  if (isFieldId(field)) {
    const def = fieldOf(fields, field);
    if (!def) return null;
    const v = valueOf(p, def);
    if (def.type === "checkbox") return v === true ? 0 : 1;
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === "number" || typeof v === "string" ? v : null;
  }
  switch (field as Exclude<CollectionSort["field"], FieldId>) {
    case "title":
      return p.title.trim() || null;
    case "status":
      if (!p.props.status) return null;
      // 상태 목록 순서. 목록에 없는 이름은 맨 뒤(이름순)
      return statusRank?.get(p.props.status) ?? 1000;
    case "assignee":
      return p.props.assignee;
    case "due":
      return p.props.due;
    case "tags":
      return p.props.tags[0] ?? null;
    case "updated":
      return p.updatedAt;
  }
}

export function sortRecords(
  records: Page[],
  sort: CollectionSort | null,
  statuses: StatusOption[] = [...DEFAULT_STATUSES],
  fields: FieldDef[] = [],
): Page[] {
  if (!sort) return records;
  const dir = sort.dir === "desc" ? -1 : 1;
  const rank = new Map(statuses.map((o, i) => [o.name, i]));
  // 키는 한 번만 구한다 (비교마다 다시 구하면 n log n번 — SYS-11). 비교는 같은 "ko" 규칙의 Collator
  const decorated = records.map((p) => ({ p, k: key(p, sort.field, rank, fields) }));
  decorated.sort((a, b) => {
    const ka = a.k;
    const kb = b.k;
    if (ka === null || kb === null) return ka === kb ? 0 : ka === null ? 1 : -1;
    const c =
      typeof ka === "number" && typeof kb === "number"
        ? ka - kb
        : koCollator.compare(String(ka), String(kb));
    return c * dir;
  });
  return decorated.map((d) => d.p);
}

const koCollator = new Intl.Collator("ko");

/** 필터 → 검색(제목·담당·태그·글로 된 사용자 속성) → 정렬 */
export function queryRecords(
  records: Page[],
  settings: Pick<CollectionSettings, "sort" | "filters"> & {
    statuses?: StatusOption[];
    fields?: FieldDef[];
  },
  search = "",
): Page[] {
  const q = search.trim().toLocaleLowerCase();
  const fields = settings.fields ?? [];
  const searchable = fields.filter((f) => SEARCHABLE.includes(f.type));
  const hit = (s: string) => s.toLocaleLowerCase().includes(q);
  const shown = records.filter(
    (p) =>
      matches(p, settings.filters, fields) &&
      (!q ||
        hit(p.title) ||
        hit(p.props.assignee ?? "") ||
        p.props.tags.some(hit) ||
        searchable.some((f) => hit(fieldText(f, valueOf(p, f))))),
  );
  return sortRecords(shown, settings.sort, settings.statuses, fields);
}

/** 필터 메뉴에 보여 줄 값들 (상태는 컬렉션 상태 목록, 담당·태그는 레코드에 실제로 있는 것) */
export function filterChoices(records: Page[], statuses: StatusOption[] = [...DEFAULT_STATUSES]) {
  const assignees = new Set<string>();
  const tags = new Set<string>();
  for (const p of records) {
    if (p.props.assignee) assignees.add(p.props.assignee);
    for (const t of p.props.tags) tags.add(t);
  }
  const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "ko"));
  return { status: statuses.map((o) => o.name), assignee: sorted(assignees), tags: sorted(tags) };
}

/** 사용자 속성 필터 메뉴 — 선택·다중 선택은 옵션, 체크박스는 체크됨·안 됨 */
export function fieldFilterChoices(
  fields: FieldDef[],
): { field: FieldId; name: string; values: { value: string; label: string }[] }[] {
  return fields
    .filter((f) => FILTERABLE.includes(f.type))
    .map((f) => ({
      field: f.id,
      name: f.name,
      values:
        f.type === "checkbox"
          ? [
              { value: "true", label: msg().collection.model.checked },
              { value: "false", label: msg().collection.model.unchecked },
            ]
          : f.options.map((o) => ({ value: o.name, label: o.name })),
    }));
}

/* ---------- 보드 (COLL-03, 2026-11-20 사용자 요청: AppFlowy 보드처럼) ---------- */

/** 칸 키: "<기준>:<값>". 값이 없으면 "없음" 칸 */
export const groupKey = (by: BoardGroupBy, value: string | null) => `${by}:${value ?? ""}`;
export const NONE_LABEL = lazyNames(NONE_KEYS, (k) => msg().collection.model.noneLabel[k]);

export type BoardGroup = {
  key: string;
  /** null이면 "없음" 칸 */
  value: string | null;
  label: string;
  color: string;
  records: Page[];
};

/**
 * 보드 칸 나누기. 순서는 records 순서를 따른다(정렬이 없으면 직접 정한 순서).
 * - 상태: 컬렉션 상태 목록 순. 목록에 없는 상태·빈 상태는 "상태 없음" 칸(레코드가 있을 때만)
 * - 담당: 이름순, 태그: 이름순 — 태그가 여럿이면 칸마다 보인다. "없음" 칸은 레코드가 있을 때만 앞에
 */
export function boardGroups(
  records: Page[],
  opts: {
    groupBy: BoardGroupBy;
    statuses: StatusOption[];
    colors: Record<string, string>;
    tagColors: Record<string, string>;
  },
): BoardGroup[] {
  const { groupBy, statuses, colors, tagColors } = opts;
  const none: Page[] = [];
  const by = new Map<string, Page[]>();
  const push = (v: string, p: Page) => by.set(v, [...(by.get(v) ?? []), p]);
  for (const p of records) {
    if (groupBy === "status") {
      if (p.props.status && statuses.some((o) => o.name === p.props.status))
        push(p.props.status, p);
      else none.push(p);
    } else if (groupBy === "assignee") {
      if (p.props.assignee) push(p.props.assignee, p);
      else none.push(p);
    } else if (p.props.tags.length) for (const t of p.props.tags) push(t, p);
    else none.push(p);
  }
  const values =
    groupBy === "status"
      ? statuses.map((o) => o.name)
      : [...by.keys()].sort((a, b) => a.localeCompare(b, "ko"));
  const colorOf = (v: string) =>
    groupBy === "status"
      ? (statuses.find((o) => o.name === v)?.color ?? "gray")
      : groupBy === "tags"
        ? (tagColors[v] ?? "gray")
        : (colors[groupKey(groupBy, v)] ?? "gray");
  const groups: BoardGroup[] = values.map((v) => ({
    key: groupKey(groupBy, v),
    value: v,
    label: v,
    color: colorOf(v),
    records: by.get(v) ?? [],
  }));
  if (none.length)
    groups.unshift({
      key: groupKey(groupBy, null),
      value: null,
      label: NONE_LABEL[groupBy],
      color: colors[groupKey(groupBy, null)] ?? "gray",
      records: none,
    });
  return groups;
}

/** 칸을 옮길 때 바뀌는 속성. 태그 칸은 원래 칸의 태그를 새 칸의 태그로 바꾼다 */
export function moveProps(
  page: Page,
  groupBy: BoardGroupBy,
  from: string | null,
  to: string | null,
): Partial<Page["props"]> | null {
  if (from === to) return null;
  if (groupBy === "status") return { status: to };
  if (groupBy === "assignee") return { assignee: to };
  const tags = page.props.tags.filter((t) => t !== from);
  if (to && !tags.includes(to)) tags.push(to);
  return { tags };
}

/** 새 레코드를 그 칸에 만들 때 채울 속성 */
export function groupProps(groupBy: BoardGroupBy, value: string | null): Partial<Page["props"]> {
  if (value === null) return {};
  if (groupBy === "status") return { status: value };
  if (groupBy === "assignee") return { assignee: value };
  return { tags: [value] };
}

/**
 * 직접 정한 순서 바꾸기: ids(지금 순서)에서 id를 빼 beforeId 앞에 넣는다.
 * beforeId가 없으면 afterId 뒤에, 둘 다 없으면 맨 뒤.
 */
export function reorder(
  ids: string[],
  id: string,
  place: { beforeId?: string | null; afterId?: string | null },
): string[] {
  const rest = ids.filter((x) => x !== id);
  if (place.beforeId && rest.includes(place.beforeId)) {
    rest.splice(rest.indexOf(place.beforeId), 0, id);
    return rest;
  }
  if (place.afterId && rest.includes(place.afterId)) {
    rest.splice(rest.indexOf(place.afterId) + 1, 0, id);
    return rest;
  }
  return [...rest, id];
}

/** 칸 머리 계산 */
export function groupCalc(records: Page[], calc: BoardCalc, today = isoDate(new Date())) {
  switch (calc) {
    case "count":
      return msg().collection.model.count(records.length);
    case "due":
      return msg().collection.model.dueCount(records.filter((p) => p.props.due).length);
    case "late":
      return msg().collection.model.lateCount(
        records.filter((p) => p.props.due && p.props.due < today).length,
      );
    case "none":
      return null;
  }
}

/** 새 상태 이름 — "새 상태", "새 상태 2" … */
export function newStatusName(statuses: StatusOption[]): string {
  const names = new Set(statuses.map((o) => o.name));
  const newStatus = msg().collection.model.newStatus;
  if (!names.has(newStatus())) return newStatus();
  let n = 2;
  while (names.has(newStatus(n))) n++;
  return newStatus(n);
}

/** 아직 안 쓴 색 (다 썼으면 회색) */
export function nextColor(statuses: StatusOption[]): string {
  const used = new Set(statuses.map((o) => o.color));
  return COLOR_NAMES.find((c) => c !== "gray" && !used.has(c)) ?? "gray";
}

/** 지역 날짜 YYYY-MM-DD */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 달력 칸: 일요일부터 6주(42칸). month는 0부터 */
export function monthGrid(
  year: number,
  month: number,
): { date: string; day: number; out: boolean }[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date: isoDate(d), day: d.getDate(), out: d.getMonth() !== month };
  });
}

/** 마감 표시: "11월 24일", 지났으면 late */
export function formatDue(
  due: string,
  today = isoDate(new Date()),
): { text: string; late: boolean } {
  const [y, m, d] = due.split("-").map(Number);
  const thisYear = today.slice(0, 4) === String(y);
  return {
    text: msg().collection.model.due({ y: thisYear ? null : y, m, d }),
    late: due < today,
  };
}

/** 본문 체크리스트 진행률 (COLL-05) */
export function checklistProgress(content: unknown): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; attrs?: { checked?: boolean }; content?: unknown[] };
    if (node.type === "taskItem") {
      total++;
      if (node.attrs?.checked) done++;
    }
    node.content?.forEach(walk);
  };
  walk(content);
  return { done, total };
}
