import { Extension, type JSONContent } from "@tiptap/core";
import type { Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** 문서(Tiptap JSON) → 다른 앱에 붙일 글자. 위 계층이 준다(마크다운 변환은 features/export) */
export type CopyAsText = (doc: JSONContent) => string;

/** ProseMirror 기본과 같은 글자 (블록 사이 빈 줄) */
function plain(slice: Slice) {
  return slice.content.textBetween(0, slice.content.size, "\n\n");
}

/**
 * 복사한 글자(text/plain)를 마크다운으로 (EDIT-26) — 다른 앱(메모장·메신저·코드 편집기)에 붙여도
 * 제목 `#` · 목록 `-` `1.` · 할 일 `[ ]` · 인용 `>` · 코드 울타리가 남는다. HTML 클립보드는 그대로라
 * 서식을 아는 앱(그리고 이 앱)은 지금처럼 서식째 붙는다. 한 블록 안의 일부만 고르면 글자 그대로.
 */
export const CopyAsTextExtension = Extension.create<{ serialize: CopyAsText | null }>({
  name: "copyAsText",
  addOptions() {
    return { serialize: null };
  },
  addProseMirrorPlugins() {
    const serialize = this.options.serialize;
    if (!serialize) return [];
    return [
      new Plugin({
        key: new PluginKey("copyAsText"),
        props: {
          clipboardTextSerializer: (slice: Slice, view: EditorView) => {
            const { $from, $to } = view.state.selection;
            // 한 블록 안(코드 블록 포함)의 일부는 글자 그대로
            if ($from.sameParent($to) && $from.parent.isTextblock) return plain(slice);
            try {
              const text = serialize({ type: "doc", content: slice.content.toJSON() ?? [] });
              return text || plain(slice);
            } catch {
              return plain(slice);
            }
          },
        },
      }),
    ];
  },
});
