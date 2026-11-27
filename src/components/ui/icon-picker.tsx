import { useMessages } from "@/lib/i18n";
import { iconValue, parsePageIcon } from "@/lib/page-icon";
import { cn } from "@/lib/utils";
import { ImageUp, Shuffle } from "lucide-react";
import { Tabs, ToggleGroup } from "radix-ui";
import * as React from "react";
import { Button } from "./button";
import { EmojiPicker, type PickedEmoji } from "./emoji-picker";
import { IconButton } from "./icon-button";
import { inputClass } from "./input";
import { PageIcon } from "./page-icon";
import { iconColorClass, PAGE_ICON_CATEGORIES, type PageIconEntry } from "./page-icon-set";
import { focusRing } from "./styles";
import { SOFT_COLORS } from "./tag-chip";

type IconPickerTab = "emoji" | "icon" | "upload";

type IconPickerProps = {
  /** 지금 아이콘 값 (없으면 "제거"를 숨긴다) */
  value?: string;
  /** 하나를 골랐을 때 — 부르는 쪽이 저장하고 닫는다 */
  onSelect: (icon: string) => void;
  /** 저장하되 닫지 않는다 — 지금 아이콘의 색 바꾸기, 무작위(다시 눌러 다른 것으로) */
  onApply?: (icon: string) => void;
  onRemove?: () => void;
  /** 최근에 고른 아이콘 값(최신순). 저장은 부르는 쪽이 한다 */
  recent?: string[];
  /** 업로드 탭: 파일 고르기(대화상자) */
  onBrowse?: () => void;
  /** 업로드 탭: 끌어 놓거나 붙여 넣은 이미지 파일 */
  onUploadFile?: (file: File) => void;
  /** 업로드 탭: 이미지 링크 */
  onUploadLink?: (url: string) => void;
  /** 올리는 중 */
  uploading?: boolean;
  /** 올리지 못한 이유 (업로드 탭에 보인다) */
  uploadError?: string;
  /** 처음 열 탭 (기본: 지금 값의 종류, 없으면 이모지) */
  defaultTab?: IconPickerTab;
  className?: string;
};

const COLUMNS = 8;
const IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp,image/avif";

const tabClass = cn(
  "relative h-10 px-1 text-ui text-secondary transition-colors hover:text-primary force-hover:text-primary",
  "data-[state=active]:font-medium data-[state=active]:text-primary",
  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-pill data-[state=active]:after:bg-primary",
  focusRing,
  "focus-visible:outline-offset-0",
);

/**
 * OV-IconPicker — 이모지 · 아이콘(lucide) · 업로드 탭과 "제거" (PAGE-10).
 * 팝오버 안에 넣어 쓴다(`<PopoverContent className="p-0">`).
 */
function IconPicker({
  value,
  onSelect,
  onApply,
  onRemove,
  recent = [],
  onBrowse,
  onUploadFile,
  onUploadLink,
  uploading,
  uploadError,
  defaultTab,
  className,
}: IconPickerProps) {
  const m = useMessages();
  const current = parsePageIcon(value);
  const [tab, setTab] = React.useState<IconPickerTab>(
    defaultTab ??
      (current?.kind === "icon" ? "icon" : current?.kind === "image" ? "upload" : "emoji"),
  );
  const recentOf = (kind: "emoji" | "icon" | "image") =>
    recent.filter((r) => parsePageIcon(r)?.kind === kind);

  return (
    <Tabs.Root
      data-slot="icon-picker"
      value={tab}
      onValueChange={(t) => setTab(t as IconPickerTab)}
      className={cn("flex w-80 flex-col text-primary", className)}
    >
      <div className="flex items-center gap-3 border-b border-line px-3">
        <Tabs.List aria-label={m.ui.iconPicker.tabs} className="flex gap-3">
          <Tabs.Trigger value="emoji" className={tabClass}>
            {m.ui.iconPicker.emoji}
          </Tabs.Trigger>
          <Tabs.Trigger value="icon" className={tabClass}>
            {m.ui.iconPicker.icon}
          </Tabs.Trigger>
          <Tabs.Trigger value="upload" className={tabClass}>
            {m.ui.iconPicker.upload}
          </Tabs.Trigger>
        </Tabs.List>
        {value && onRemove ? (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onRemove}>
            {m.ui.iconPicker.remove}
          </Button>
        ) : null}
      </div>

      <Tabs.Content value="emoji" className="outline-none">
        <EmojiPicker
          // 아이콘 탭과 같은 폭(w-80)으로 맞춘다 — 검색 칸 폭이 탭마다 달라지지 않게
          className="w-80"
          recent={recentOf("emoji").map((e) => ({ emoji: e, label: e }))}
          onSelect={(e: PickedEmoji) => onSelect(e.emoji)}
          onRandom={(e: PickedEmoji) => (onApply ?? onSelect)(e.emoji)}
        />
      </Tabs.Content>
      <Tabs.Content value="icon" className="outline-none">
        <IconTab
          current={current?.kind === "icon" ? current : undefined}
          recent={recentOf("icon")}
          onSelect={onSelect}
          onApply={onApply}
        />
      </Tabs.Content>
      <Tabs.Content value="upload" className="outline-none">
        <UploadTab
          recent={recentOf("image")}
          onSelect={onSelect}
          onBrowse={onBrowse}
          onUploadFile={onUploadFile}
          onUploadLink={onUploadLink}
          uploading={uploading}
          error={uploadError}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}

/* ───────── 아이콘 탭 ───────── */

const matches = (i: PageIconEntry, q: string) =>
  i.name.includes(q) || i.keywords.includes(q) || i.name.replace(/-/g, " ").includes(q);

function IconTab({
  current,
  recent,
  onSelect,
  onApply,
}: {
  current?: { name: string; color: string | null };
  recent: string[];
  onSelect: (icon: string) => void;
  onApply?: (icon: string) => void;
}) {
  const m = useMessages();
  const catNames: Record<string, string> = m.ui.iconPicker.categories;
  const [query, setQuery] = React.useState("");
  const [color, setColor] = React.useState<string>(current?.color ?? "default");
  const q = query.trim().toLowerCase();

  const groups = React.useMemo(() => {
    const cats = PAGE_ICON_CATEGORIES.map((c) => ({
      id: c.id,
      name: catNames[c.id] ?? c.name,
      icons: q ? c.icons.filter((i) => matches(i, q)) : c.icons,
    })).filter((c) => c.icons.length);
    const found = cats.flatMap((c) => c.icons);
    return q
      ? found.length
        ? [{ id: "result", name: m.ui.iconPicker.searchResults, icons: found }]
        : []
      : cats;
  }, [q, m, catNames]);

  const recentEntries = q
    ? []
    : recent
        .flatMap((r) => {
          const v = parsePageIcon(r);
          if (v?.kind !== "icon") return [];
          const e = PAGE_ICON_CATEGORIES.flatMap((c) => c.icons).find((i) => i.name === v.name);
          return e ? [e] : [];
        })
        // 색만 다른 같은 아이콘은 한 번만
        .filter((e, i, all) => all.indexOf(e) === i);
  const sections = recentEntries.length
    ? [
        { id: "recent", name: m.ui.iconPicker.recent, icons: recentEntries.slice(0, COLUMNS) },
        ...groups,
      ]
    : groups;

  const pick = (name: string) => onSelect(iconValue(name, color));
  // 무작위는 창을 닫지 않는다 — 마음에 들 때까지 다시 누른다
  const shuffle = () => {
    const all = PAGE_ICON_CATEGORIES.flatMap((c) => c.icons);
    const name = all[Math.floor(Math.random() * all.length)]!.name;
    (onApply ?? onSelect)(iconValue(name, color));
  };

  return (
    <div className="flex h-90 flex-col">
      <div className="flex items-center gap-2 p-2">
        <input
          type="search"
          aria-label={m.ui.iconPicker.search}
          placeholder={m.ui.iconPicker.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // 이모지 탭과 검색 칸 폭을 같게 맞춘다 (w-56). 뒤 버튼 수가 달라도 칸은 그대로
          className={cn(inputClass, "min-h-8 w-56 shrink-0")}
        />
        <IconButton label={m.ui.iconPicker.random} size="md" onClick={shuffle}>
          <Shuffle strokeWidth={1.5} />
        </IconButton>
      </div>

      <ToggleGroup.Root
        type="single"
        aria-label={m.ui.iconPicker.color}
        value={color}
        onValueChange={(c) => {
          if (!c) return;
          setColor(c);
          if (current && onApply) onApply(iconValue(current.name, c));
        }}
        className="flex items-center gap-1 px-3 pb-2"
      >
        {(["default", ...SOFT_COLORS] as const).map((c) => (
          <ToggleGroup.Item
            key={c}
            value={c}
            aria-label={m.ui.color[c]}
            className={cn(
              "grid size-6 place-items-center rounded-pill hover:bg-hover data-[state=on]:bg-active force-hover:bg-hover",
              focusRing,
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-3 rounded-pill bg-current",
                c === "default" ? "text-secondary" : iconColorClass(c),
              )}
            />
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      <IconGrid
        sections={sections}
        colorClass={iconColorClass(color === "default" ? null : color)}
        selected={current?.name}
        onPick={pick}
        empty={q ? m.ui.iconPicker.noResults(query.trim()) : undefined}
      />
    </div>
  );
}

type Section = { id: string; name: string; icons: PageIconEntry[] };

/** 카테고리별 아이콘 격자 — 칸 하나만 Tab으로 들어오고 화살표로 움직인다 */
function IconGrid({
  sections,
  colorClass,
  selected,
  onPick,
  empty,
}: {
  sections: Section[];
  colorClass: string;
  selected?: string;
  onPick: (name: string) => void;
  empty?: string;
}) {
  const m = useMessages();
  // 줄 단위 위치 (카테고리마다 줄을 새로 시작한다)
  const rows = React.useMemo(() => {
    const out: { key: string }[][] = [];
    for (const s of sections)
      for (let i = 0; i < s.icons.length; i += COLUMNS)
        out.push(s.icons.slice(i, i + COLUMNS).map((icon) => ({ key: `${s.id}:${icon.name}` })));
    return out;
  }, [sections]);
  const [active, setActive] = React.useState<string>();
  const activeKey = rows.some((r) => r.some((c) => c.key === active)) ? active : rows[0]?.[0]?.key;
  const [hover, setHover] = React.useState<PageIconEntry>();
  const listRef = React.useRef<HTMLDivElement>(null);

  const focusKey = (next: string) => {
    setActive(next);
    listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(next)}"]`)?.focus();
  };
  /** Home·End: 줄 처음·끝, ⌘(⌃)와 함께면 목록 처음·끝 */
  const jump = (key: string, end: boolean, all: boolean) => {
    const r = rows.findIndex((row) => row.some((c) => c.key === key));
    if (r < 0) return;
    const row = all ? rows[end ? rows.length - 1 : 0]! : rows[r]!;
    focusKey(row[end ? row.length - 1 : 0]!.key);
  };
  const move = (key: string, dRow: number, dCol: number) => {
    const r = rows.findIndex((row) => row.some((c) => c.key === key));
    if (r < 0) return;
    const c = rows[r]!.findIndex((x) => x.key === key);
    let nr = r;
    let nc = c + dCol;
    if (nc < 0 && r > 0) {
      nr = r - 1;
      nc = rows[nr]!.length - 1;
    } else if (nc >= rows[r]!.length && r < rows.length - 1) {
      nr = r + 1;
      nc = 0;
    }
    nr = Math.min(Math.max(0, nr + dRow), rows.length - 1);
    nc = Math.min(Math.max(0, nc), rows[nr]!.length - 1);
    focusKey(rows[nr]![nc]!.key);
  };

  return (
    <>
      <div
        ref={listRef}
        role="group"
        aria-label={m.ui.iconPicker.list}
        className="min-h-0 flex-1 overflow-y-auto pb-2"
      >
        {sections.length === 0 ? (
          <p
            role="status"
            className="grid h-full place-items-center px-6 text-center text-caption text-tertiary"
          >
            {empty}
          </p>
        ) : (
          sections.map((s) => (
            <div key={s.id} role="group" aria-label={s.name}>
              <div className="sticky top-0 bg-elevated px-3 pt-3 pb-1 text-label font-medium text-tertiary">
                {s.name}
              </div>
              <div className="grid grid-cols-8 px-2">
                {s.icons.map((icon) => {
                  const key = `${s.id}:${icon.name}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      data-key={key}
                      tabIndex={key === activeKey ? 0 : -1}
                      aria-label={icon.keywords}
                      aria-pressed={selected === icon.name || undefined}
                      onClick={() => onPick(icon.name)}
                      onFocus={() => {
                        setActive(key);
                        setHover(icon);
                      }}
                      onMouseEnter={() => setHover(icon)}
                      onKeyDown={(e) => {
                        if (e.key === "Home" || e.key === "End") {
                          e.preventDefault();
                          jump(key, e.key === "End", e.metaKey || e.ctrlKey);
                          return;
                        }
                        const d: Record<string, [number, number]> = {
                          ArrowLeft: [0, -1],
                          ArrowRight: [0, 1],
                          ArrowUp: [-1, 0],
                          ArrowDown: [1, 0],
                        };
                        const step = d[e.key];
                        if (!step) return;
                        e.preventDefault();
                        move(key, step[0], step[1]);
                      }}
                      className={cn(
                        "grid size-8 scroll-my-8 place-items-center rounded-md hover:bg-hover aria-pressed:bg-active force-hover:bg-hover",
                        focusRing,
                        "focus-visible:-outline-offset-2",
                      )}
                    >
                      <icon.Icon
                        aria-hidden
                        strokeWidth={1.5}
                        className={cn("size-5", colorClass)}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex h-9 shrink-0 items-center gap-2 border-t border-line px-3">
        {hover ? (
          <>
            <hover.Icon aria-hidden strokeWidth={1.5} className={cn("size-4", colorClass)} />
            <span className="truncate text-caption text-secondary">{hover.keywords}</span>
          </>
        ) : (
          <span className="text-caption text-tertiary">{m.ui.iconPicker.pickHint}</span>
        )}
      </div>
    </>
  );
}

/* ───────── 업로드 탭 ───────── */

const firstImage = (list: DataTransfer | null) =>
  [...(list?.files ?? [])].find((f) => f.type.startsWith("image/"));

function UploadTab({
  recent,
  onSelect,
  onBrowse,
  onUploadFile,
  onUploadLink,
  uploading,
  error,
}: {
  recent: string[];
  onSelect: (icon: string) => void;
  onBrowse?: () => void;
  onUploadFile?: (file: File) => void;
  onUploadLink?: (url: string) => void;
  uploading?: boolean;
  error?: string;
}) {
  const m = useMessages();
  const [over, setOver] = React.useState(false);
  const [link, setLink] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const linkId = React.useId();
  const errorId = React.useId();

  const browse = () => (onBrowse ? onBrowse() : fileRef.current?.click());
  const submitLink = () => {
    const url = link.trim();
    if (!url || !onUploadLink || uploading) return;
    // 못 가져오면 고쳐서 다시 올리도록 칸은 비우지 않는다(성공하면 팝오버가 닫힌다)
    onUploadLink(url);
  };

  return (
    <div
      className="flex h-90 flex-col gap-3 p-3"
      onPaste={(e) => {
        const file = firstImage(e.clipboardData);
        if (file && onUploadFile && !uploading) {
          e.preventDefault();
          onUploadFile(file);
        }
      }}
    >
      <button
        type="button"
        // 올리는 중에도 포커스를 잃지 않게 disabled 대신 aria-disabled
        aria-disabled={uploading || undefined}
        aria-describedby={error ? errorId : undefined}
        onClick={() => !uploading && browse()}
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = firstImage(e.dataTransfer);
          if (file && !uploading) onUploadFile?.(file);
        }}
        className={cn(
          "flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-4 text-center text-caption text-secondary transition-colors",
          "hover:bg-hover aria-disabled:opacity-60 force-hover:bg-hover",
          over && "border-accent bg-accent-soft",
          focusRing,
        )}
      >
        <ImageUp aria-hidden strokeWidth={1.5} className="size-5 text-tertiary" />
        <span role="status">
          {uploading ? m.ui.iconPicker.uploading : m.ui.iconPicker.dropzone}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_TYPES}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadFile?.(file);
          e.target.value = "";
        }}
      />

      {onUploadLink ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitLink();
          }}
        >
          <label htmlFor={linkId} className="sr-only">
            {m.ui.iconPicker.imageLink}
          </label>
          <input
            id={linkId}
            type="url"
            inputMode="url"
            placeholder={m.ui.iconPicker.linkPlaceholder}
            value={link}
            readOnly={uploading}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => setLink(e.target.value)}
            className={cn(inputClass, "min-h-8 min-w-0 flex-1")}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!link.trim()}
            aria-disabled={uploading || undefined}
          >
            {m.ui.iconPicker.apply}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-caption text-pretty text-danger">
          {error}
        </p>
      ) : null}

      {recent.length ? (
        <div className="min-h-0">
          <div className="pb-1 text-label font-medium text-tertiary">
            {m.ui.iconPicker.recentImages}
          </div>
          <div
            role="group"
            aria-label={m.ui.iconPicker.recentImagesGroup}
            className="grid grid-cols-8 gap-1"
          >
            {recent.slice(0, 16).map((r, i) => (
              <button
                key={r}
                type="button"
                aria-label={m.ui.iconPicker.recentImage(i + 1)}
                onClick={() => onSelect(r)}
                className={cn(
                  "grid size-8 place-items-center rounded-md text-h3 hover:bg-hover force-hover:bg-hover",
                  focusRing,
                )}
              >
                <PageIcon icon={r} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { IconPicker, type IconPickerProps, type IconPickerTab };
