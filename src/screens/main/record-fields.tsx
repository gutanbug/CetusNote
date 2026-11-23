import { AssigneePicker, DuePicker, type RecordItem } from "@/components/collection/fields";
import { PROPERTY_ICONS } from "@/components/collection/property-types";
import { fieldOf, formatDue, isoDate, nextColor, statusesOf } from "@/features/collection/model";
import { pagesStore } from "@/features/pages";
import { isFieldId, normalizeCollection, type Page, type StatusOption } from "@/lib/storage";
import { valueCell } from "./collection-properties";
import { tagColor } from "./tag-colors";

/** 페이지 → 레코드 한 줄 (CL-*에 넘기는 모양) */
export function toRecordItem(
  page: Page,
  tagColors: Record<string, string> | undefined,
  today = isoDate(new Date()),
  statuses?: StatusOption[],
): RecordItem {
  const { status, assignee, due, tags } = page.props;
  return {
    id: page.id,
    title: page.title,
    ...(page.icon ? { emoji: page.icon } : {}),
    ...(status
      ? { status, statusColor: tagColor(statuses?.find((o) => o.name === status)?.color) }
      : {}),
    ...(assignee ? { assignee } : {}),
    ...(due ? { due: { date: due, ...formatDue(due, today) } } : {}),
    tags: tags.map((name) => ({ name, color: tagColor(tagColors?.[name]) })),
  };
}

/** 워크스페이스에서 쓴 담당 이름 (자주 쓴 순) */
export function assigneeChoices(pages: Record<string, Page>): string[] {
  const count = new Map<string, number>();
  for (const p of Object.values(pages))
    if (p.props.assignee && !p.trashedAt)
      count.set(p.props.assignee, (count.get(p.props.assignee) ?? 0) + 1);
  return [...count]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([name]) => name);
}

/** 레코드 속성 고치기 */
export function setRecordProps(id: string, patch: Partial<Page["props"]>) {
  const page = pagesStore.getState().pages[id];
  if (!page) return;
  pagesStore.getState().update(id, { props: { ...page.props, ...patch } });
}

/** 컬렉션 레코드면 PG-Properties에 담당·마감 칸을 붙인다 (COLL-01) */
export function recordFields(page: Page, all: Record<string, Page>) {
  const parent = page.parentId ? all[page.parentId] : undefined;
  if (parent?.kind !== "collection") return {};
  const statuses = statusesOf(parent);
  const item = toRecordItem(page, undefined);
  const settings = parent.collection ?? normalizeCollection(null);
  const hidden = (key: string) => settings.properties.find((p) => p.key === key)?.hidden;
  const today = isoDate(new Date());
  // 사용자 속성 (COLL-08) — 컬렉션 순서대로, 숨긴 것은 빼고
  const extra = settings.properties.flatMap((slot) => {
    if (slot.hidden || !isFieldId(slot.key)) return [];
    const def = fieldOf(settings.fields, slot.key);
    if (!def) return [];
    return [
      {
        key: def.id,
        name: def.name,
        icon: PROPERTY_ICONS[def.type],
        content: valueCell(
          def,
          page,
          today,
          (field, name) => {
            const cur = pagesStore.getState().pages[parent.id];
            const s = cur?.collection ?? settings;
            const f = fieldOf(s.fields, field.id);
            if (!cur || !f || f.options.some((o) => o.name === name)) return;
            pagesStore.getState().update(parent.id, {
              collection: {
                ...s,
                fields: s.fields.map((x) =>
                  x.id === f.id
                    ? { ...x, options: [...x.options, { name, color: nextColor(x.options) }] }
                    : x,
                ),
              },
            });
          },
          "min-h-7.5 px-2",
        ),
      },
    ];
  });
  return {
    extra,
    // 상태는 그 컬렉션의 상태 목록에서 고른다 (스키마 4)
    statusOptions: statuses.map((o) => ({ name: o.name, color: tagColor(o.color) })),
    assignee: hidden("assignee") ? undefined : (
      <AssigneePicker
        label="담당"
        value={item.assignee}
        choices={assigneeChoices(all)}
        onChange={(name) => setRecordProps(page.id, { assignee: name ?? null })}
        className="min-h-7.5 px-2"
      />
    ),
    due: hidden("due") ? undefined : (
      <DuePicker
        label="마감"
        value={item.due}
        onChange={(date) => setRecordProps(page.id, { due: date ?? null })}
        className="min-h-7.5 px-2"
      />
    ),
  };
}
