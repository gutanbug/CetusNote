import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { inputClass } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { focusRing, menuItem } from "@/components/ui/styles";
import { TagChip } from "@/components/ui/tag-chip";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  Check,
  Eye,
  EyeOff,
  Link,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import * as React from "react";
import { EmptyValue } from "./fields";
import {
  ADDABLE,
  PROPERTY_ICONS,
  PROPERTY_TYPE_NAMES,
  type CustomProperty,
  type PropertyEntry,
  type PropertyOption,
  type PropertyType,
  type PropertyValue,
} from "./property-types";
import { valueButton } from "./styles";

const ic = { strokeWidth: 1.5, "aria-hidden": true } as const;

/** 속성 아이콘 (lucide 16px 규칙보다 작은 14px — 이름 칸 안) */
export function PropertyIcon({
  kind,
  className,
}: {
  kind: PropertyEntry["kind"];
  className?: string;
}) {
  const Icon = PROPERTY_ICONS[kind];
  return <Icon {...ic} className={cn("size-3.5 shrink-0", className)} />;
}

/* ---------- CL-PropertyValue: 사용자 속성 값 칸 ---------- */

type ValueProps = {
  field: CustomProperty;
  value: PropertyValue;
  /** 날짜·만든·고친 날짜의 표시 문구 (부르는 쪽이 지역 형식으로 만든다) */
  text?: string;
  onChange: (value: PropertyValue) => void;
  /** 선택·다중 선택에서 새 옵션 만들기 — 만든 뒤 값으로 고른다 */
  onCreateOption?: (name: string) => void;
  /** 접근성 이름 — 표 칸은 "레코드 이름 속성 이름". 없으면 속성 이름 */
  label?: string;
  className?: string;
};

const linkHref = (type: PropertyType, v: string) =>
  type === "url"
    ? /^https?:\/\//i.test(v)
      ? v
      : `https://${v}`
    : type === "email"
      ? `mailto:${v}`
      : type === "phone"
        ? `tel:${v.replace(/[^\d+]/g, "")}`
        : null;

/**
 * CL-PropertyValue — 사용자 속성 값 하나 (COLL-08). 표 칸과 상세 행이 함께 쓴다.
 * 글·숫자·링크는 팝오버 입력(Enter·바깥 누르기로 저장, Esc 취소), 체크박스는 바로 토글,
 * 선택은 찾기 + 옵션 목록(없는 이름은 Enter로 새로 만든다), 만든·고친 날짜는 읽기 전용.
 */
export function PropertyValueCell({
  field,
  value,
  text,
  onChange,
  onCreateOption,
  label: given,
  className,
}: ValueProps) {
  const label = given ?? field.name;
  if (field.type === "created" || field.type === "updated")
    return (
      <span
        className={cn(
          valueButton,
          "cursor-default text-secondary hover:bg-transparent force-hover:bg-transparent",
          className,
        )}
      >
        <span className="sr-only">{label}: </span>
        {text || <EmptyValue />}
      </span>
    );
  if (field.type === "checkbox") {
    return (
      <span
        className={cn(valueButton, "hover:bg-transparent force-hover:bg-transparent", className)}
      >
        <Checkbox
          aria-label={label}
          checked={value === true}
          onCheckedChange={(c) => onChange(c === true)}
        />
      </span>
    );
  }
  if (field.type === "select" || field.type === "multi")
    return (
      <OptionPicker
        field={field}
        value={value}
        onChange={onChange}
        onCreateOption={onCreateOption}
        label={label}
        className={className}
      />
    );
  return (
    <TextPicker
      field={field}
      value={value}
      text={text}
      onChange={onChange}
      label={label}
      className={className}
    />
  );
}

function TextPicker({ field, value, text, onChange, label, className }: ValueProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  /** Esc로 닫으면 입력을 버리고 값을 그대로 둔다 (이름 바꾸기와 같은 규칙) */
  const cancelled = React.useRef(false);
  const errorId = React.useId();
  const kind = field.type;
  const shown =
    text ??
    (typeof value === "number"
      ? value.toLocaleString("ko-KR")
      : typeof value === "string"
        ? value
        : "");
  /** 값으로 바꾼다. 숫자가 아니면 false — 팝오버를 닫지 않고 오류를 보인다 */
  const commit = (): boolean => {
    const v = draft.trim();
    if (kind === "number") {
      const n = Number(v.replace(/,/g, ""));
      if (v !== "" && !Number.isFinite(n)) {
        setError("숫자만 입력해요");
        return false;
      }
      onChange(v === "" ? null : n);
    } else onChange(v === "" ? null : v);
    setError(null);
    return true;
  };
  const href = typeof value === "string" && value ? linkHref(kind, value) : null;
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) {
          cancelled.current = false;
          setError(null);
          setDraft(value === null || value === undefined ? "" : String(value));
          setOpen(true);
          return;
        }
        if (!cancelled.current && !commit()) return;
        cancelled.current = false;
        setOpen(false);
      }}
    >
      <PopoverTrigger className={cn(valueButton, className)}>
        <span className="sr-only">{label ?? field.name}: </span>
        {shown ? (
          <span
            className={cn(
              "min-w-0 truncate",
              kind === "number" && "tabular-nums",
              href && "text-accent underline decoration-line-strong underline-offset-2",
            )}
          >
            {shown}
          </span>
        ) : (
          <EmptyValue />
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-70 p-2"
        onEscapeKeyDown={() => {
          cancelled.current = true;
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (commit()) setOpen(false);
          }}
        >
          {kind === "text" ? (
            <textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // 한글 조합 중 Enter는 글자 확정이라 넘긴다. Shift+Enter는 줄바꿈
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (commit()) setOpen(false);
                }
              }}
              aria-label={label ?? field.name}
              className={cn(inputClass, "min-h-15 resize-none py-1.5 text-caption")}
            />
          ) : (
            <input
              autoFocus
              type={
                kind === "date"
                  ? "date"
                  : kind === "email"
                    ? "email"
                    : kind === "url"
                      ? "url"
                      : kind === "phone"
                        ? "tel"
                        : "text"
              }
              inputMode={kind === "number" ? "decimal" : undefined}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={label ?? field.name}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              placeholder={kind === "url" ? "https://" : undefined}
              className={cn(inputClass, "h-7.5 min-h-7.5 text-caption")}
            />
          )}
        </form>
        {error ? (
          <p id={errorId} role="alert" className="px-1 pt-1 text-label text-danger">
            {error}
          </p>
        ) : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={cn(menuItem, focusRing, "mt-1")}
          >
            <Link {...ic} />
            {kind === "url" ? "링크 열기" : kind === "email" ? "메일 쓰기" : "전화 걸기"}
            <span className="sr-only"> (새 창)</span>
          </a>
        ) : null}
        {value !== null && value !== "" ? (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              onChange(null);
              setOpen(false);
            }}
            className={cn(menuItem, focusRing, "mt-1 text-secondary")}
          >
            <X {...ic} />
            비우기
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function OptionPicker({ field, value, onChange, onCreateOption, label, className }: ValueProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const multi = field.type === "multi";
  const picked = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const q = draft.trim();
  const shown = field.options.filter(
    (o) => !q || o.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()),
  );
  const colorOf = (name: string) => field.options.find((o) => o.name === name)?.color ?? "gray";
  const toggle = (name: string) => {
    if (!multi) {
      onChange(picked[0] === name ? null : name);
      setOpen(false);
      return;
    }
    const next = picked.includes(name) ? picked.filter((x) => x !== name) : [...picked, name];
    onChange(next.length ? next : null);
  };
  const create = () => {
    if (!q || !onCreateOption) return;
    if (field.options.some((o) => o.name === q)) return toggle(q);
    onCreateOption(q.slice(0, 60));
    setDraft("");
    if (!multi) setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft("");
      }}
    >
      <PopoverTrigger className={cn(valueButton, "flex-wrap", className)}>
        <span className="sr-only">{label ?? field.name}: </span>
        {picked.length ? (
          picked.map((n) => (
            <TagChip key={n} color={colorOf(n)}>
              {n}
            </TagChip>
          ))
        ) : (
          <EmptyValue />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`${field.name} 옵션 찾기`}
            placeholder={onCreateOption ? "찾거나 새로 적고 Enter" : "찾기"}
            className={cn(inputClass, "h-7.5 min-h-7.5 text-caption")}
          />
        </form>
        <div
          role="group"
          aria-label={`${field.name} 옵션`}
          className="mt-1 grid max-h-56 overflow-y-auto"
        >
          {shown.map((o) => (
            <button
              key={o.name}
              type="button"
              aria-pressed={picked.includes(o.name)}
              onClick={() => toggle(o.name)}
              className={cn(menuItem, focusRing)}
            >
              <TagChip color={o.color}>{o.name}</TagChip>
              {picked.includes(o.name) ? <Check {...ic} className="ml-auto" /> : null}
            </button>
          ))}
        </div>
        {q && onCreateOption && !field.options.some((o) => o.name === q) ? (
          <button type="button" onClick={create} className={cn(menuItem, focusRing)}>
            <Plus {...ic} />“{q}” 만들기
          </button>
        ) : null}
        {!shown.length && !q ? (
          <p className="px-2 py-1 text-caption text-tertiary">옵션을 적어 만들어요</p>
        ) : null}
        {!shown.length && q && !onCreateOption ? (
          <p className="px-2 py-1 text-caption text-tertiary">일치하는 옵션이 없어요</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- CL-AddProperty: 속성 추가 메뉴 ---------- */

/** CL-AddProperty — 종류를 골라 사용자 속성을 더한다 (표 머리 ＋ · 상세 · 속성 목록) */
export function AddPropertyMenu({
  onAdd,
  children,
  align = "start",
}: {
  onAdd: (type: PropertyType) => void;
  /** 트리거 (DropdownMenuTrigger asChild 안에 들어간다) */
  children: React.ReactElement;
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-96 w-48 overflow-y-auto">
        <DropdownMenuLabel>속성 종류</DropdownMenuLabel>
        {ADDABLE.map((t) => (
          <DropdownMenuItem key={t} icon={<PropertyIcon kind={t} />} onSelect={() => onAdd(t)}>
            {PROPERTY_TYPE_NAMES[t]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------- CL-PropertyMenu: 속성 하나 편집 ---------- */

type PropertyMenuProps = {
  entry: PropertyEntry;
  /** 선택·다중 선택이면 옵션 목록 (이름 바꾸기·지우기) */
  options?: PropertyOption[];
  onRename?: (name: string) => void;
  onToggleHidden: () => void;
  onToggleCard: () => void;
  onMove?: (dir: -1 | 1) => void;
  onDelete?: () => void;
  onRenameOption?: (from: string, to: string) => void;
  onDeleteOption?: (name: string) => void;
  /** 트리거 — 표 머리 버튼이나 상세 행 이름 */
  children: React.ReactElement;
  /** 앞·뒤로 옮기는 말 — 표는 왼쪽·오른쪽, 상세는 위·아래 */
  axis?: "x" | "y";
  align?: "start" | "end";
};

/**
 * CL-PropertyMenu — 속성 이름·숨기기·카드 표시·순서·지우기와 선택 옵션 편집 (COLL-08).
 * 이름 입력이 있어 메뉴가 아니라 팝오버다(메뉴의 글자 찾기가 입력을 가로채지 않게). 기본 속성은 이름을 못 바꾸고 지울 수 없다.
 */
export function PropertyMenu({
  entry,
  options,
  onRename,
  onToggleHidden,
  onToggleCard,
  onMove,
  onDelete,
  onRenameOption,
  onDeleteOption,
  children,
  axis = "x",
  align = "start",
}: PropertyMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(entry.name);
  const [confirm, setConfirm] = React.useState(false);
  /** Esc로 닫으면 이름 바꾸기를 취소한다 (값 칸 입력과 같게) */
  const cancelled = React.useRef(false);
  const commitName = () => {
    if (onRename && name.trim() && name.trim() !== entry.name) onRename(name.trim());
  };
  const close = () => setOpen(false);
  const typeName = entry.builtin ? "기본 속성" : PROPERTY_TYPE_NAMES[entry.kind as PropertyType];
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o && !cancelled.current) commitName();
        if (o) {
          setName(entry.name);
          setConfirm(false);
        }
        cancelled.current = false;
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-60 p-1"
        aria-label={`${entry.name} 속성`}
        onEscapeKeyDown={() => {
          cancelled.current = true;
        }}
      >
        <div className="grid gap-1 px-1 pt-1 pb-1">
          {onRename && !entry.builtin ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitName();
                close();
              }}
            >
              <input
                autoFocus
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                aria-label="속성 이름"
                className={cn(inputClass, "h-7.5 min-h-7.5 text-caption")}
              />
            </form>
          ) : (
            <p className="flex items-center gap-2 px-1 text-ui font-medium text-primary">
              <PropertyIcon kind={entry.kind} className="text-secondary" />
              {entry.name}
            </p>
          )}
          <p className="flex items-center gap-1.5 px-1 text-label text-tertiary">
            {entry.builtin ? null : <PropertyIcon kind={entry.kind} />}
            {typeName}
          </p>
        </div>
        {options && options.length && onRenameOption && onDeleteOption ? (
          <div
            role="group"
            aria-label="옵션"
            className="grid gap-0.5 border-t border-line px-1 py-1"
          >
            <span className="px-1 py-0.5 text-label text-tertiary">옵션</span>
            {options.map((o) => (
              <OptionRow
                key={o.name}
                option={o}
                onRename={(to) => onRenameOption(o.name, to)}
                onDelete={() => onDeleteOption(o.name)}
              />
            ))}
          </div>
        ) : null}
        <div className="grid border-t border-line pt-1">
          {onMove ? (
            <>
              <button type="button" className={cn(menuItem, focusRing)} onClick={() => onMove(-1)}>
                <ArrowUp {...ic} className={axis === "x" ? "-rotate-90" : undefined} />
                {axis === "x" ? "왼쪽으로" : "위로"}
              </button>
              <button type="button" className={cn(menuItem, focusRing)} onClick={() => onMove(1)}>
                <ArrowDown {...ic} className={axis === "x" ? "-rotate-90" : undefined} />
                {axis === "x" ? "오른쪽으로" : "아래로"}
              </button>
            </>
          ) : null}
          <button
            type="button"
            aria-pressed={entry.card}
            className={cn(menuItem, focusRing)}
            onClick={onToggleCard}
          >
            <Check {...ic} className={cn(!entry.card && "invisible")} />
            보드 카드에 보이기
          </button>
          <button
            type="button"
            className={cn(menuItem, focusRing)}
            onClick={() => {
              onToggleHidden();
              close();
            }}
          >
            {entry.hidden ? <Eye {...ic} /> : <EyeOff {...ic} />}
            {entry.hidden ? "보이기" : "숨기기"}
          </button>
          {onDelete && !entry.builtin ? (
            <button
              type="button"
              className={cn(menuItem, focusRing, "text-danger [&_svg]:text-danger")}
              onClick={() => {
                if (!confirm) return setConfirm(true);
                onDelete();
                close();
              }}
            >
              <Trash2 {...ic} />
              <span aria-live="polite">
                {confirm ? "한 번 더 누르면 지워요 (값도 함께)" : "속성 지우기"}
              </span>
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OptionRow({
  option,
  onRename,
  onDelete,
}: {
  option: PropertyOption;
  onRename: (to: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = React.useState(option.name);
  const commit = () => {
    const v = draft.trim();
    if (v && v !== option.name) onRename(v);
    else setDraft(option.name);
  };
  return (
    <div className="flex items-center gap-1">
      <span aria-hidden className="shrink-0">
        <TagChip color={option.color} className="size-3 min-w-3 p-0">
          {""}
        </TagChip>
      </span>
      <input
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            commit();
          }
        }}
        aria-label={`옵션 이름: ${option.name}`}
        className={cn(inputClass, "h-6.5 min-h-6.5 min-w-0 flex-1 text-caption")}
      />
      <IconButton
        label={`옵션 지우기: ${option.name}`}
        onClick={onDelete}
        className="size-6 text-tertiary [&_svg]:size-3.5"
      >
        <X {...ic} />
      </IconButton>
    </div>
  );
}

/* ---------- CL-PropertyList: 툴바 "속성" — 보이기·카드·순서 한눈에 ---------- */

/**
 * CL-PropertyList — 컬렉션의 모든 속성을 한 목록에서 보이기/숨기기, 카드 표시, 순서 바꾸기 (COLL-08).
 * 각 줄의 이름을 누르면 CL-PropertyMenu가 열린다(menu). 맨 아래 "속성 추가".
 */
export function PropertyList({
  entries,
  menu,
  onToggleHidden,
  onToggleCard,
  onMove,
  onAdd,
}: {
  entries: PropertyEntry[];
  /** 이름 버튼을 감쌀 편집 메뉴 */
  menu?: (entry: PropertyEntry, trigger: React.ReactElement) => React.ReactNode;
  onToggleHidden: (key: string) => void;
  onToggleCard: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onAdd: (type: PropertyType) => void;
}) {
  const small = "size-6 text-tertiary [&_svg]:size-3.5 aria-pressed:text-accent";
  return (
    <div className="grid gap-0.5">
      <ul aria-label="속성" className="grid gap-0.5">
        {entries.map((e, i) => {
          const nameButton = (
            <button
              type="button"
              className={cn(menuItem, focusRing, "min-w-0 flex-1", e.hidden && "text-tertiary")}
            >
              <PropertyIcon kind={e.kind} />
              <span className="truncate">{e.name}</span>
            </button>
          );
          return (
            <li key={e.key} className="flex items-center gap-0.5">
              {menu ? menu(e, nameButton) : nameButton}
              {/* 토글 이름은 상태와 관계없이 고정, 상태는 aria-pressed (켜지면 포인트 색) */}
              <IconButton
                label={`${e.name} 보드 카드 표시`}
                aria-pressed={e.card}
                onClick={() => onToggleCard(e.key)}
                className={small}
              >
                <Columns3 {...ic} />
              </IconButton>
              <IconButton
                label={`${e.name} 표시`}
                aria-pressed={!e.hidden}
                onClick={() => onToggleHidden(e.key)}
                className={small}
              >
                {e.hidden ? <EyeOff {...ic} /> : <Eye {...ic} />}
              </IconButton>
              {/* disabled는 누르는 순간 포커스를 잃게 만든다(맨 위로 올리면 "위로"가 꺼짐). aria-disabled로 포커스를 남긴다 */}
              <IconButton
                label={`${e.name} 위로`}
                aria-disabled={i === 0 || undefined}
                onClick={() => i > 0 && onMove(e.key, -1)}
                className={cn(small, "aria-disabled:pointer-events-none aria-disabled:opacity-35")}
              >
                <ArrowUp {...ic} />
              </IconButton>
              <IconButton
                label={`${e.name} 아래로`}
                aria-disabled={i === entries.length - 1 || undefined}
                onClick={() => i < entries.length - 1 && onMove(e.key, 1)}
                className={cn(small, "aria-disabled:pointer-events-none aria-disabled:opacity-35")}
              >
                <ArrowDown {...ic} />
              </IconButton>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line pt-1">
        <AddPropertyMenu onAdd={onAdd}>
          <button type="button" className={cn(menuItem, focusRing, "text-secondary")}>
            <Plus {...ic} />
            속성 추가
          </button>
        </AddPropertyMenu>
      </div>
    </div>
  );
}
