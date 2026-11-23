import type { Editor } from "@tiptap/core";
import * as React from "react";

function readDom(editor: Editor): HTMLElement | null {
  // 뷰가 붙기 전에는 editor.view가 대역(Proxy)이라 dom을 읽으면 오류가 난다
  try {
    return editor.isDestroyed ? null : editor.view.dom;
  } catch {
    return null;
  }
}

/**
 * 에디터 본문 요소. 뷰가 붙거나(mount) 떨어지면(unmount) 다시 읽는다.
 * StrictMode처럼 에디터가 떼었다 다시 붙으면 본문 요소가 새것이 되므로, 이벤트·속성은 이 값에 걸어야 한다.
 */
export function useEditorDom(editor: Editor): HTMLElement | null {
  const [dom, setDom] = React.useState(() => readDom(editor));
  React.useEffect(() => {
    const update = () => setDom(readDom(editor));
    update();
    editor.on("mount", update);
    editor.on("unmount", update);
    return () => {
      editor.off("mount", update);
      editor.off("unmount", update);
    };
  }, [editor]);
  return dom;
}
