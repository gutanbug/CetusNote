import type { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Columns2,
  Grid2x2X,
  PanelLeft,
  PanelTop,
  Rows2,
  TableCellsMerge,
  TableCellsSplit,
} from "lucide-react";
import * as React from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Separator } from "@/components/ui/separator";
import { popoverSurface } from "@/components/ui/styles";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { currentTableElement, floatingBounds } from "./floating-bounds";
import { useEditorDom } from "./use-editor-dom";
import { useMessages } from "@/lib/i18n";

const ic = { strokeWidth: 1.5 } as const;

type Action = { label: string; icon: React.ReactNode; run: () => boolean; danger?: boolean };

/**
 * 표 편집 바가 떠 있는 상태인지. shouldShow와 같은 조건이다
 * (글자를 고르면 서식 바가 대신 뜨므로, 이 바는 빈 커서나 셀 선택일 때만 뜬다).
 */
export const tableToolbarActive = (editor: Editor) =>
  editor.isEditable &&
  editor.isActive("table") &&
  (editor.state.selection.empty || editor.state.selection instanceof CellSelection);

const barButtons = (bar: HTMLElement | null | undefined) => [
  ...(bar?.querySelectorAll<HTMLButtonElement>('[data-slot="icon-button"]') ?? []),
];

/** ED-TableMenu — 표 안에 커서가 있을 때 표 위에 뜨는 편집 바 */
export function TableMenu({ editor }: { editor: Editor }) {
  const m = useMessages();
  const barRef = React.useRef<HTMLDivElement>(null);
  const editorDom = useEditorDom(editor);
  // 로빙 탭인덱스: Tab으로는 한 번만 들어가고, 안에서는 ←→ Home End로 옮긴다
  const [cursor, setCursor] = React.useState(0);
  const c = () => editor.chain().focus();

  // ⌥F10: 표 도구 모음의 첫 단추로 들어간다 (서식 바 ED-FloatingToolbar와 같은 키)
  React.useEffect(() => {
    const dom = editorDom;
    if (!dom) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.altKey && e.key === "F10") || !tableToolbarActive(editor)) return;
      const bar = barRef.current;
      const first = barButtons(bar)[0];
      // 숨겨진 바(위치 잡기 전 등)에는 포커스를 주지 않고 키를 그대로 둔다
      if (!first || bar?.style.visibility === "hidden") return;
      e.preventDefault();
      setCursor(0);
      first.focus();
    };
    dom.addEventListener("keydown", onKey);
    return () => dom.removeEventListener("keydown", onKey);
  }, [editor, editorDom]);

  // 바 안의 키: ←→ Home End로 옮기고, Esc로 본문 커서에 돌아간다.
  // BubbleMenu의 onKeyDown은 네이티브 이벤트를 감싸서 e.key를 못 읽으므로 원본 요소에 직접 건다
  React.useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        editor.commands.focus();
        return;
      }
      const bs = barButtons(bar);
      const i = bs.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      let next: number | null = null;
      if (e.key === "ArrowRight") next = (i + 1) % bs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + bs.length) % bs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = bs.length - 1;
      if (next === null) return;
      e.preventDefault();
      setCursor(next);
      bs[next]?.focus();
    };
    // 단추에 포커스가 가면 그 단추가 로빙 탭인덱스의 자리가 된다(마우스로 눌러도 같다)
    const onFocusIn = (e: FocusEvent) => {
      const i = barButtons(bar).indexOf(e.target as HTMLButtonElement);
      if (i >= 0) setCursor(i);
    };
    bar.addEventListener("keydown", onKey);
    bar.addEventListener("focusin", onFocusIn);
    return () => {
      bar.removeEventListener("keydown", onKey);
      bar.removeEventListener("focusin", onFocusIn);
    };
  }, [editor]);
  const groups: Action[][] = [
    [
      {
        label: m.editor.table.addRowAbove,
        icon: <BetweenHorizontalStart {...ic} />,
        run: () => c().addRowBefore().run(),
      },
      {
        label: m.editor.table.addRowBelow,
        icon: <BetweenHorizontalEnd {...ic} />,
        run: () => c().addRowAfter().run(),
      },
      {
        label: m.editor.table.addColLeft,
        icon: <BetweenVerticalStart {...ic} />,
        run: () => c().addColumnBefore().run(),
      },
      {
        label: m.editor.table.addColRight,
        icon: <BetweenVerticalEnd {...ic} />,
        run: () => c().addColumnAfter().run(),
      },
    ],
    [
      {
        label: m.editor.table.toggleHeaderRow,
        icon: <PanelTop {...ic} />,
        run: () => c().toggleHeaderRow().run(),
      },
      {
        label: m.editor.table.toggleHeaderCol,
        icon: <PanelLeft {...ic} />,
        run: () => c().toggleHeaderColumn().run(),
      },
      {
        label: m.editor.table.mergeCells,
        icon: <TableCellsMerge {...ic} />,
        run: () => c().mergeCells().run(),
      },
      {
        label: m.editor.table.splitCell,
        icon: <TableCellsSplit {...ic} />,
        run: () => c().splitCell().run(),
      },
    ],
    [
      {
        label: m.editor.table.deleteRow,
        icon: <Rows2 {...ic} />,
        run: () => c().deleteRow().run(),
        danger: true,
      },
      {
        label: m.editor.table.deleteCol,
        icon: <Columns2 {...ic} />,
        run: () => c().deleteColumn().run(),
        danger: true,
      },
      {
        label: m.editor.table.deleteTable,
        icon: <Grid2x2X {...ic} />,
        run: () => {
          if (!c().deleteTable().run()) return false;
          // 표는 한 번에 많이 사라진다 — ⌘Z 말고도 바로 되돌릴 수 있게
          toast(m.editor.table.deleted, {
            action: {
              label: m.editor.table.undo,
              onClick: () => editor.chain().focus().undo().run(),
            },
          });
          return true;
        },
        danger: true,
      },
    ],
  ];

  const flat = groups.flat();

  return (
    <BubbleMenu
      ref={barRef}
      editor={editor}
      pluginKey="tableMenu"
      // 글자를 고르면 서식 바(ED-FloatingToolbar)가 뜨므로 표 편집 바는 비킨다
      shouldShow={({ editor: e }) => tableToolbarActive(e)}
      // 표 전체 위에 붙이고(셀이 아니라 표 사각형 기준), 뒤집기·밀기는 에디터 영역 안에서만 한다
      getReferencedVirtualElement={() => currentTableElement(editor)}
      options={{ placement: "top", offset: 8, ...floatingBounds(editor) }}
      role="toolbar"
      aria-label={m.editor.table.toolbar}
      aria-orientation="horizontal"
      className={cn(popoverSurface, "flex items-center gap-0.5 rounded-pill px-1.5")}
    >
      {groups.map((g, i) => (
        <div key={i} className="contents">
          {i > 0 ? <Separator orientation="vertical" className="mx-1 h-4 self-center" /> : null}
          {g.map((a) => (
            <IconButton
              key={a.label}
              label={a.label}
              tabIndex={flat.indexOf(a) === cursor ? 0 : -1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                // Enter·Space로 실행했을 때(detail 0)만 포커스를 돌려준다
                const keyboard = e.detail === 0;
                const idx = flat.indexOf(a);
                a.run();
                if (!keyboard) return;
                // 명령이 본문 포커스를 다음 프레임에 주므로(Tiptap focus) 그 뒤에 돌린다
                requestAnimationFrame(() => {
                  if (editor.isDestroyed) return;
                  if (editor.isActive("table")) barButtons(barRef.current)[idx]?.focus();
                  // 표가 사라졌다(표 삭제) — 본문 커서로
                  else editor.commands.focus();
                });
              }}
              className={
                a.danger
                  ? "hover:bg-danger-soft hover:text-danger force-hover:bg-danger-soft force-hover:text-danger"
                  : undefined
              }
            >
              {a.icon}
            </IconButton>
          ))}
        </div>
      ))}
    </BubbleMenu>
  );
}
