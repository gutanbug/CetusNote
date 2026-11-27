import type { ImageSource } from "@/components/editor/image";
import { NoteEditor } from "@/components/editor/note-editor";
import type { MentionSource } from "@/components/editor/page-mention";
import { assetUrl, useAssetUrl } from "@/features/assets";
import { usePages, usePagesWhile } from "@/features/pages";
import { useSession } from "@/features/session";
import { cn } from "@/lib/utils";
import type { JSONContent } from "@tiptap/core";
import * as React from "react";
import { createPortal } from "react-dom";
import { resolveMention } from "./mention-model";
import { useMainUi } from "./ui-store";

import { PRINT_ROOT_ID as ROOT_ID } from "./print-ready";
import { PageIcon } from "@/components/ui/page-icon";

/**
 * PDF 내보내기(DATA-06)의 인쇄 전용 화면 — body 바로 아래 #print-root에 페이지 제목과 읽기 전용 본문을 그린다.
 * 화면에서는 늘 숨고(globals.css), 쪽을 찍는 동안(html[data-pdf-capture])에만 보인다.
 * 쪽 나누기는 pdf-layout.ts가 한다. 다음 내보내기 전까지 남겨 둔다.
 */
export function PrintView() {
  const id = useMainUi((s) => s.printId);
  const page = usePages((s) => (id ? s.pages[id] : undefined));
  const all = usePagesWhile(id !== null);
  const cover = useAssetUrl(page?.cover);
  const dim = useSession((s) => s.editor.dimChecked);
  const calc = useSession((s) => s.editor.calc);
  const images = React.useMemo<ImageSource>(
    () => ({
      load: (src) => assetUrl(src),
      upload: () => Promise.reject(new Error("읽기 전용")),
      pick: async () => null,
    }),
    [],
  );
  const mentions = React.useMemo<MentionSource>(
    () => ({ search: () => [], resolve: (m) => resolveMention(all, m), onOpen: () => {} }),
    [all],
  );
  if (!page || page.kind !== "page") return null;
  return createPortal(
    <div
      id={ROOT_ID}
      data-page={page.id}
      // 인쇄 화면은 접근성 트리에서 뺀다(화면에서는 늘 숨김)
      aria-hidden
      className={cn(
        "bg-app text-primary",
        page.layout.font === "serif" && "[--font-body:var(--font-serif)]",
        page.layout.font === "mono" && "[--font-body:var(--font-mono)]",
      )}
    >
      {page.cover ? (
        cover ? (
          <img
            src={cover}
            alt=""
            className="mb-6 block aspect-[4/1] w-full rounded-md object-cover"
          />
        ) : (
          <div data-status="loading" />
        )
      ) : null}
      {page.icon ? (
        <div className="text-page-icon leading-none">
          <PageIcon icon={page.icon} />
        </div>
      ) : null}
      <h1 className="mt-2 mb-6 text-title font-bold tracking-(--tracking-display) break-words">
        {page.title || "제목 없음"}
      </h1>
      <NoteEditor
        key={page.updatedAt}
        content={page.content as JSONContent}
        editable={false}
        label={`${page.title || "제목 없음"} 본문`}
        mentions={mentions}
        images={images}
        spellCheck={false}
        dimChecked={dim}
        calc={calc}
      />
    </div>,
    document.body,
  );
}
