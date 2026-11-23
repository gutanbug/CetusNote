import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { Editor } from "@tiptap/core";
import * as React from "react";
import { createPortal } from "react-dom";
import { useEditorDom } from "./use-editor-dom";

type CaretPopupProps = {
  editor: Editor;
  /** 캐럿 위치. 바뀔 때마다 새 함수를 넘기면 다시 잰다 */
  clientRect: () => DOMRect | null;
  /** 목록 id — 에디터의 aria-controls가 가리킨다 */
  listId: string;
  /** 고른 항목 id — 에디터의 aria-activedescendant */
  activeOptionId?: string;
  children: React.ReactNode;
};

/**
 * 캐럿 아래에 뜨는 목록(슬래시 메뉴 · 멘션 제안)의 공통 틀(@floating-ui/dom).
 * 포커스는 에디터에 그대로 두고, 에디터에 aria-controls · aria-activedescendant를 달아
 * 화면 읽기 프로그램이 고른 항목을 읽게 한다.
 */
export function CaretPopup({
  editor,
  clientRect,
  listId,
  activeOptionId,
  children,
}: CaretPopupProps) {
  const floatingRef = React.useRef<HTMLDivElement>(null);
  const editorDom = useEditorDom(editor);

  React.useLayoutEffect(() => {
    const floating = floatingRef.current;
    if (!floating) return;
    const reference = {
      getBoundingClientRect: () => clientRect() ?? new DOMRect(),
      contextElement: editorDom ?? undefined,
    };
    const place = () =>
      computePosition(reference, floating, {
        placement: "bottom-start",
        strategy: "fixed",
        middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        floating.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        floating.style.visibility = "visible";
      });
    return autoUpdate(reference, floating, place);
  }, [clientRect, editorDom]);

  React.useEffect(() => {
    const dom = editorDom;
    if (!dom) return;
    dom.setAttribute("aria-controls", listId);
    // textbox 역할에는 aria-expanded를 쓸 수 없다(axe aria-allowed-attr)
    dom.setAttribute("aria-autocomplete", "list");
    if (activeOptionId) dom.setAttribute("aria-activedescendant", activeOptionId);
    else dom.removeAttribute("aria-activedescendant");
    return () => {
      for (const a of ["aria-controls", "aria-autocomplete", "aria-activedescendant"]) {
        dom.removeAttribute(a);
      }
    };
  }, [editorDom, listId, activeOptionId]);

  // 자리(translate)는 바깥, 열림 애니메이션(pop도 transform을 쓴다)은 안쪽에 둔다.
  // 한 요소에 같이 두면 애니메이션이 (0,0)에서 캐럿까지 미끄러지듯 움직인다.
  // 첫 자리를 재기 전에는 숨겨 왼쪽 위에 한 번 그려지지 않게 한다.
  return createPortal(
    <div ref={floatingRef} className="invisible fixed top-0 left-0 z-50">
      <div className="animate-pop">{children}</div>
    </div>,
    document.body,
  );
}
