import type { GridColumn } from "@/components/collection/grid-view";
import {
  AddPropertyMenu,
  PropertyList,
  PropertyMenu,
  PropertyValueCell,
} from "@/components/collection/property";
import type {
  CustomProperty,
  PropertyEntry,
  PropertyType,
} from "@/components/collection/property-types";
import type { DetailRow } from "@/components/collection/record-detail";
import { IconButton } from "@/components/ui/icon-button";
import { focusRing, menuItem } from "@/components/ui/styles";
import { toast } from "@/components/ui/toast";
import {
  addField,
  BUILTIN_NAMES,
  deleteField,
  fieldOf,
  fieldText,
  moveProperty,
  nextColor,
  remapOption,
  renameField,
  setFieldOptions,
  setPropertySlot,
  valueOf,
  withValue,
} from "@/features/collection/model";
import { pagesStore } from "@/features/pages";
import {
  FIELDS_MAX,
  isFieldId,
  type CollectionSettings,
  type FieldDef,
  type FieldId,
  type FieldValue,
  type Page,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import type * as React from "react";
import { tagColor } from "./tag-colors";

/** 사용자 속성 정의 → CL-* 모양 (색 이름을 칩 색으로) */
export const toCustomProperty = (f: FieldDef): CustomProperty => ({
  id: f.id,
  name: f.name,
  type: f.type,
  options: f.options.map((o) => ({ name: o.name, color: tagColor(o.color) })),
});

/** 속성 순서 → 메뉴·목록 모양 */
export function propertyEntries(settings: CollectionSettings): PropertyEntry[] {
  return settings.properties.flatMap((slot): PropertyEntry[] => {
    if (isFieldId(slot.key)) {
      const f = fieldOf(settings.fields, slot.key);
      return f
        ? [
            {
              key: f.id,
              name: f.name,
              kind: f.type,
              builtin: false,
              hidden: slot.hidden,
              card: slot.card,
            },
          ]
        : [];
    }
    return [
      {
        key: slot.key,
        name: BUILTIN_NAMES[slot.key],
        kind: slot.key,
        builtin: true,
        hidden: slot.hidden,
        card: slot.card,
      },
    ];
  });
}

/** 레코드 값 하나 고치기 */
export function setRecordValue(id: string, field: FieldId, value: FieldValue | null) {
  const page = pagesStore.getState().pages[id];
  if (!page) return;
  pagesStore.getState().update(id, { props: withValue(page.props, field, value) });
}

/** 값 칸 — 표·상세·PG-Properties가 함께 쓴다 */
export function valueCell(
  def: FieldDef,
  page: Page,
  today: string,
  addOption?: (field: FieldDef, name: string) => void,
  className?: string,
  label?: string,
) {
  const value = valueOf(page, def);
  const dated = def.type === "date" || def.type === "created" || def.type === "updated";
  return (
    <PropertyValueCell
      field={toCustomProperty(def)}
      value={value}
      text={dated ? fieldText(def, value, today) : undefined}
      onChange={(v) => setRecordValue(page.id, def.id, v)}
      onCreateOption={
        addOption
          ? (name) => {
              addOption(def, name);
              // 만든 옵션을 바로 값으로
              const cur = valueOf(pagesStore.getState().pages[page.id] ?? page, def);
              setRecordValue(
                page.id,
                def.id,
                def.type === "multi" ? [...(Array.isArray(cur) ? cur : []), name] : name,
              );
            }
          : undefined
      }
      className={className}
      label={label}
    />
  );
}

/**
 * 컬렉션 속성 동작 (COLL-08) — 툴바 "속성", 표 머리·상세 행 메뉴, 속성 추가, 값 칸을 한곳에서 만든다.
 */
export function collectionProperties({
  settings,
  setSettings,
  records,
  today,
}: {
  settings: CollectionSettings;
  setSettings: (patch: Partial<CollectionSettings>) => void;
  records: Page[];
  today: string;
}) {
  const entries = propertyEntries(settings);
  const visible = entries.filter((e) => !e.hidden);

  const add = (type: PropertyType) => {
    const out = addField(settings, type);
    if (!out) {
      toast.error(`속성은 컬렉션마다 ${FIELDS_MAX}개까지 만들 수 있어요.`);
      return;
    }
    setSettings(out.patch);
  };
  const toggleHidden = (key: string) => {
    const e = entries.find((x) => x.key === key);
    if (e) setSettings(setPropertySlot(settings, e.key as never, { hidden: !e.hidden }));
  };
  const toggleCard = (key: string) => {
    const e = entries.find((x) => x.key === key);
    if (e) setSettings(setPropertySlot(settings, e.key as never, { card: !e.card }));
  };
  const move = (key: string, dir: -1 | 1) => {
    const patch = moveProperty(settings, key as never, dir);
    if (patch) setSettings(patch);
  };
  const addOption = (field: FieldDef, name: string) => {
    const cur = fieldOf(settings.fields, field.id) ?? field;
    if (cur.options.some((o) => o.name === name)) return;
    setSettings(
      setFieldOptions(settings, field.id, [
        ...cur.options,
        { name, color: nextColor(cur.options) },
      ]),
    );
  };
  const replaceOption = (field: FieldDef, from: string, to: string | null) => {
    if (to !== null && field.options.some((o) => o.name === to)) {
      toast.error(`“${to}” 옵션이 이미 있어요.`);
      return;
    }
    for (const { id, value } of remapOption(records, field, from, to))
      setRecordValue(id, field.id, value);
    const options =
      to === null
        ? field.options.filter((o) => o.name !== from)
        : field.options.map((o) => (o.name === from ? { ...o, name: to } : o));
    setSettings({
      ...setFieldOptions(settings, field.id, options),
      // 그 옵션으로 건 필터도 함께
      filters: settings.filters.flatMap((f) =>
        f.field === field.id && f.value === from ? (to ? [{ ...f, value: to }] : []) : [f],
      ),
    });
  };
  const remove = (id: FieldId) => {
    for (const r of records) if (id in r.props.values) setRecordValue(r.id, id, null);
    setSettings(deleteField(settings, id));
  };

  /** 속성 메뉴로 트리거를 감싼다 */
  const menu =
    (e: PropertyEntry, axis: "x" | "y") =>
    (trigger: React.ReactElement): React.ReactNode => {
      const def = isFieldId(e.key) ? fieldOf(settings.fields, e.key) : undefined;
      return (
        <PropertyMenu
          entry={e}
          axis={axis}
          options={def ? toCustomProperty(def).options : undefined}
          onRename={
            def
              ? (name) => {
                  const patch = renameField(settings, def.id, name);
                  if (patch) setSettings(patch);
                  else toast.error("같은 이름의 속성이 있어요. 다른 이름을 써 주세요.");
                }
              : undefined
          }
          onToggleHidden={() => toggleHidden(e.key)}
          onToggleCard={() => toggleCard(e.key)}
          onMove={(dir) => move(e.key, dir)}
          onDelete={def ? () => remove(def.id) : undefined}
          onRenameOption={def ? (from, to) => replaceOption(def, from, to) : undefined}
          onDeleteOption={def ? (name) => replaceOption(def, name, null) : undefined}
        >
          {trigger}
        </PropertyMenu>
      );
    };

  const cellFor = (key: string, page: Page | undefined, className?: string, inRow = false) => {
    const def = isFieldId(key) ? fieldOf(settings.fields, key) : undefined;
    if (!def || !page) return null;
    // 표 칸은 어느 레코드인지 이름에 넣는다 (기본 칸 "제목 상태"와 같게)
    const label = inRow ? `${page.title || "제목 없음"} ${def.name}` : undefined;
    // 표에서는 숫자를 오른쪽에 맞춘다
    const cls = inRow && def.type === "number" ? cn("justify-end", className) : className;
    return valueCell(def, page, today, addOption, cls, label);
  };

  /** 표 열 */
  const columns = (pages: Record<string, Page>): GridColumn[] =>
    visible.map((e) => ({
      key: e.key,
      name: e.name,
      kind: e.kind,
      menu: menu(e, "x"),
      cell: e.builtin ? undefined : (item) => cellFor(e.key, pages[item.id], undefined, true),
    }));

  /** 상세 행 */
  const rows = (page: Page): DetailRow[] =>
    visible.map((e) => ({
      key: e.key,
      name: e.name,
      kind: e.kind,
      menu: menu(e, "y"),
      content: e.builtin ? undefined : cellFor(e.key, page, "min-h-7.5 px-2"),
    }));

  /** 보드 카드에 보일 사용자 속성 (값이 있는 것만) */
  const cardExtra = (page: Page) =>
    visible.flatMap((e) => {
      if (!e.card) return [];
      if (e.key === "status")
        return page.props.status ? [{ key: e.key, name: e.name, text: page.props.status }] : [];
      const def = isFieldId(e.key) ? fieldOf(settings.fields, e.key) : undefined;
      if (!def) return [];
      const text = fieldText(def, valueOf(page, def), today);
      if (!text) return [];
      // 선택은 표·상세처럼 색 칩으로
      if (def.type === "select" || def.type === "multi") {
        const v = valueOf(page, def);
        const names = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
        const color = (n: string) => tagColor(def.options.find((o) => o.name === n)?.color);
        return [
          {
            key: e.key,
            name: e.name,
            text,
            chips: names.map((n) => ({ name: n, color: color(n) })),
          },
        ];
      }
      return [{ key: e.key, name: e.name, text: def.type === "checkbox" ? `✓ ${e.name}` : text }];
    });
  /** 카드에서 뺄 기본 속성 (숨겼거나 카드 표시를 끈 것) */
  const cardHidesBuiltin = (key: "assignee" | "due" | "tags") => {
    const e = entries.find((x) => x.key === key);
    return !e || e.hidden || !e.card;
  };

  const list = (
    <PropertyList
      entries={entries}
      menu={(e, trigger) => menu(e, "y")(trigger)}
      onToggleHidden={toggleHidden}
      onToggleCard={toggleCard}
      onMove={move}
      onAdd={add}
    />
  );

  const addColumn = (
    <AddPropertyMenu onAdd={add} align="end">
      <IconButton label="속성 추가">
        <Plus strokeWidth={1.5} />
      </IconButton>
    </AddPropertyMenu>
  );
  const addRow = (
    <AddPropertyMenu onAdd={add}>
      <button type="button" className={cn(menuItem, focusRing, "w-auto text-tertiary")}>
        <Plus strokeWidth={1.5} aria-hidden />
        속성 추가
      </button>
    </AddPropertyMenu>
  );

  return {
    entries,
    visible,
    columns,
    rows,
    cardExtra,
    cardHidesBuiltin,
    list,
    addColumn,
    addRow,
    addOption,
  };
}
