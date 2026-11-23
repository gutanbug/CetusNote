import { isTextSelection, type Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { ChevronDown, Code, Highlighter, Link, Palette } from "lucide-react";
import * as React from "react";
import { ColorPicker, type ColorValue } from "@/components/ui/color-popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { LinkEditor } from "@/components/ui/link-popover";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { focusRing, popoverSurface } from "@/components/ui/styles";
import type { SoftColor } from "@/components/ui/tag-chip";
import { floatingBounds } from "./floating-bounds";
import { useEditorDom } from "./use-editor-dom";
import { cn } from "@/lib/utils";

type BlockType = {
  id: string;
  label: string;
  isActive: (e: Editor) => boolean;
  convert: (e: Editor) => boolean;
};

const base = (e: Editor) => e.chain().focus().clearNodes();

/** 블록 변환 목록 — 프로토타입 openTypePop()과 같은 순서. 감싸는 블록(목록·인용·콜아웃)을 먼저 본다 */
const BLOCK_TYPES: BlockType[] = [
  {
    id: "taskList",
    label: "체크리스트",
    isActive: (e) => e.isActive("taskList"),
    convert: (e) => base(e).toggleTaskList().run(),
  },
  {
    id: "bulletList",
    label: "글머리 목록",
    isActive: (e) => e.isActive("bulletList"),
    convert: (e) => base(e).toggleBulletList().run(),
  },
  {
    id: "orderedList",
    label: "번호 목록",
    isActive: (e) => e.isActive("orderedList"),
    convert: (e) => base(e).toggleOrderedList().run(),
  },
  {
    id: "blockquote",
    label: "인용",
    isActive: (e) => e.isActive("blockquote"),
    convert: (e) => base(e).toggleBlockquote().run(),
  },
  {
    id: "callout",
    label: "콜아웃",
    isActive: (e) => e.isActive("callout"),
    convert: (e) => base(e).setCallout().run(),
  },
  ...([1, 2, 3] as const).map((level): BlockType => ({
    id: `heading${level}`,
    label: `제목 ${level}`,
    isActive: (e) => e.isActive("heading", { level }),
    convert: (e) => base(e).setHeading({ level }).run(),
  })),
  {
    id: "paragraph",
    label: "텍스트",
    isActive: () => true,
    convert: (e) => base(e).setParagraph().run(),
  },
];
/** 메뉴에 보일 순서 (프로토타입과 같음) */
const MENU_ORDER = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "callout",
];

/** "var(--c-red-fg)" → "red" */
function softColorOf(value: unknown): SoftColor | null {
  const m = typeof value === "string" ? /--c-([a-z]+)-(?:fg|bg)/.exec(value) : null;
  return (m?.[1] as SoftColor | undefined) ?? null;
}

type Pop = "color" | "link" | null;

export type FloatingToolbarProps = {
  editor: Editor;
  /** 링크 열기(외부 브라우저). 위 계층이 준다. 없으면 열기 버튼을 숨긴다 */
  onOpenLink?: (href: string) => void;
};

/**
 * ED-FloatingToolbar — 글자를 고르면 위에 뜨는 서식 바 (프로토타입 `.floatbar`).
 * 키보드: ⌥F10으로 바에 들어가고, ←→로 옮기고, Esc로 본문에 돌아간다.
 */
export function FloatingToolbar({ editor, onOpenLink }: FloatingToolbarProps) {
  const [pop, setPop] = React.useState<Pop>(null);
  const [typeOpen, setTypeOpen] = React.useState(false);
  const barRef = React.useRef<HTMLDivElement>(null);
  // shouldShow는 플러그인이 붙잡고 있으므로 최신 값을 ref로 본다
  const holdRef = React.useRef(false);
  React.useLayoutEffect(() => {
    holdRef.current = pop !== null || typeOpen;
  }, [pop, typeOpen]);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      highlight: e.isActive("highlight"),
      color: {
        text: softColorOf(e.getAttributes("textStyle").color),
        highlight: softColorOf(e.getAttributes("highlight").color),
      } satisfies ColorValue,
      type: BLOCK_TYPES.find((t) => t.isActive(e))!.id,
    }),
  });

  // ⌥F10: 서식 바로 들어간다 (ARIA 툴바 관례)
  const editorDom = useEditorDom(editor);
  React.useEffect(() => {
    const dom = editorDom;
    if (!dom) return;
    const onKey = (e: KeyboardEvent) => {
      // ⌥F10 우선순위: 글자를 고른 상태면 서식 바, 빈 커서·셀 선택이면 표 도구 모음(ED-TableMenu)
      const textSelected =
        !editor.state.selection.empty && !(editor.state.selection instanceof CellSelection);
      if (e.altKey && e.key === "F10" && textSelected && barRef.current?.offsetParent) {
        e.preventDefault();
        barRef.current.querySelector<HTMLElement>("button")?.focus();
      }
      // ⌘⇧K: 고른 글자에 링크 (프로토타입 단축키)
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "k" &&
        !editor.state.selection.empty
      ) {
        e.preventDefault();
        setPop("link");
      }
    };
    dom.addEventListener("keydown", onKey);
    return () => dom.removeEventListener("keydown", onKey);
  }, [editor, editorDom]);

  // 적용해서 에디터로 돌아갔으면 그대로 두고, Esc로 닫았으면 기본대로 트리거 버튼에 포커스를 돌려준다
  const keepEditorFocus = (e: Event) => {
    if (editor.view.hasFocus()) e.preventDefault();
  };

  const onBarKeyDown = (e: React.KeyboardEvent) => {
    const buttons = [
      ...(barRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []),
    ];
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      editor.commands.focus();
    }
  };

  const c = () => editor.chain().focus();
  const marks = [
    {
      id: "bold",
      label: "굵게",
      keys: ["⌘", "B"],
      glyph: <span className="font-bold">B</span>,
      run: () => c().toggleBold().run(),
    },
    {
      id: "italic",
      label: "기울임",
      keys: ["⌘", "I"],
      glyph: <span className="font-serif italic">I</span>,
      run: () => c().toggleItalic().run(),
    },
    {
      id: "underline",
      label: "밑줄",
      keys: ["⌘", "U"],
      glyph: <span className="underline">U</span>,
      run: () => c().toggleUnderline().run(),
    },
    {
      id: "strike",
      label: "취소선",
      keys: ["⌘", "⇧", "S"],
      glyph: <span className="line-through">S</span>,
      run: () => c().toggleStrike().run(),
    },
    {
      id: "code",
      label: "인라인 코드",
      keys: ["⌘", "E"],
      glyph: <Code strokeWidth={1.5} />,
      run: () => c().toggleCode().run(),
    },
  ] as const;

  const typeLabel = BLOCK_TYPES.find((t) => t.id === s.type)!.label;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="floatingToolbar"
      // 뒤집기·밀기 경계는 에디터 스크롤 영역(상단 바 아래)이다. 뷰포트 끝에서 다음 줄을 가리지 않는다
      options={{ placement: "top", offset: 8, ...floatingBounds(editor) }}
      shouldShow={({ editor: e, state, view, from, to }) => {
        if (holdRef.current) return true;
        const { selection } = state;
        if (!e.isEditable || selection.empty || selection instanceof CellSelection) return false;
        if (!isTextSelection(selection) || !state.doc.textBetween(from, to).length) return false;
        // 코드 블록·이미지 캡션은 서식이 없다
        if (e.isActive("codeBlock") || e.isActive("image")) return false;
        return view.hasFocus() || !!barRef.current?.contains(document.activeElement);
      }}
    >
      <div
        ref={barRef}
        role="toolbar"
        aria-label="텍스트 서식"
        aria-orientation="horizontal"
        data-slot="floating-toolbar"
        onKeyDown={onBarKeyDown}
        className={cn(popoverSurface, "flex items-center gap-0.5 rounded-pill")}
      >
        <DropdownMenu open={typeOpen} onOpenChange={setTypeOpen} modal={false}>
          <DropdownMenuTrigger
            className={cn(
              "flex h-7 items-center gap-1 rounded-pill px-2 text-caption text-primary hover:bg-hover data-[state=open]:bg-hover force-hover:bg-hover",
              focusRing,
            )}
            aria-label={`블록 변환, 지금은 ${typeLabel}`}
          >
            {typeLabel}
            <ChevronDown strokeWidth={1.5} className="size-4 text-tertiary" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent onCloseAutoFocus={keepEditorFocus}>
            <DropdownMenuLabel>블록 변환</DropdownMenuLabel>
            {MENU_ORDER.map((id) => {
              const t = BLOCK_TYPES.find((x) => x.id === id)!;
              return (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={id === s.type}
                  onSelect={() => t.convert(editor)}
                >
                  {t.label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-0.5 h-4.5 self-center" />

        {marks.map((m) => (
          <IconButton
            key={m.id}
            size="md"
            className="size-7"
            label={m.label}
            shortcut={<Kbd keys={[...m.keys]} />}
            aria-pressed={s[m.id]}
            onClick={m.run}
          >
            {m.glyph}
          </IconButton>
        ))}

        <Popover open={pop === "link"} onOpenChange={(o) => setPop(o ? "link" : null)}>
          <PopoverAnchor asChild>
            <IconButton
              size="md"
              className="size-7"
              label="링크"
              shortcut={<Kbd keys={["⌘", "⇧", "K"]} />}
              aria-pressed={s.link}
              aria-haspopup="dialog"
              aria-expanded={pop === "link"}
              onClick={() => setPop(pop === "link" ? null : "link")}
            >
              <Link strokeWidth={1.5} />
            </IconButton>
          </PopoverAnchor>
          <PopoverContent
            aria-label="링크"
            className="w-auto max-w-none p-0"
            onCloseAutoFocus={keepEditorFocus}
          >
            <LinkEditor
              href={s.href}
              onSubmit={(href) => {
                c().extendMarkRange("link").setLink({ href }).run();
                setPop(null);
              }}
              onOpen={onOpenLink}
              onRemove={() => {
                c().extendMarkRange("link").unsetLink().run();
                setPop(null);
              }}
            />
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-0.5 h-4.5 self-center" />

        <Popover open={pop === "color"} onOpenChange={(o) => setPop(o ? "color" : null)}>
          <PopoverAnchor asChild>
            <IconButton
              size="md"
              className="size-7"
              label="글자 색"
              aria-haspopup="dialog"
              aria-expanded={pop === "color"}
              on={!!(s.color.text || s.color.highlight)}
              onClick={() => setPop(pop === "color" ? null : "color")}
            >
              <Palette strokeWidth={1.5} />
            </IconButton>
          </PopoverAnchor>
          <PopoverContent aria-label="색" className="w-auto p-1" onCloseAutoFocus={keepEditorFocus}>
            <ColorPicker
              value={s.color}
              onChange={(v) => {
                const ch = c();
                if (v.text !== s.color.text) {
                  if (v.text) ch.setColor(`var(--c-${v.text}-fg)`);
                  else ch.unsetColor();
                }
                if (v.highlight !== s.color.highlight) {
                  if (v.highlight) ch.setHighlight({ color: `var(--c-${v.highlight}-bg)` });
                  else ch.unsetHighlight();
                }
                ch.run();
              }}
            />
          </PopoverContent>
        </Popover>
        <IconButton
          size="md"
          className="size-7"
          label="하이라이트"
          shortcut={<Kbd keys={["⌘", "⇧", "H"]} />}
          aria-pressed={s.highlight}
          onClick={() => c().toggleHighlight().run()}
        >
          <Highlighter strokeWidth={1.5} />
        </IconButton>
      </div>
    </BubbleMenu>
  );
}
