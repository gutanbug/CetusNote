import type { ImageSource } from "@/components/editor/image";
import { NoteEditor } from "@/components/editor/note-editor";
import type { MentionSource } from "@/components/editor/page-mention";
import { VersionHistory, type VersionListStatus } from "@/components/page/version-history";
import { toast } from "@/components/ui/toast";
import { assetUrl } from "@/features/assets";
import { groupVersions, restoreVersion } from "@/features/history";
import { pagesStore, usePages } from "@/features/pages";
import { getStorage } from "@/lib/storage/default";
import type { Page, PageVersion } from "@/lib/storage";
import type { JSONContent } from "@tiptap/core";
import * as React from "react";
import { resolveMention } from "./mention-model";
import { useMainUi } from "./ui-store";
import { useRestoreFocus } from "./use-restore-focus";

const REASON = {
  missing: "이 페이지는 지금 고칠 수 없어서 되돌리지 않았어요.",
  snapshot: "지금 내용을 먼저 남기지 못해서 되돌리지 않았어요.",
  read: "그 버전을 읽지 못했어요.",
  save: "되돌린 내용을 저장하지 못했어요. 다시 해 보세요.",
} as const;

/**
 * 버전 기록 (DATA-09) — 사이드 메뉴 `버전 기록…`과 ⌘K "버전 기록"으로 연다.
 * 목록·미리보기·되돌리기를 맡고, 화면은 components/page/version-history가 그린다.
 */
export function VersionHistoryDialog() {
  const pageId = useMainUi((s) => s.historyPageId);
  // 페이지가 바뀌거나 닫히면 상태를 새로 만든다 (key)
  return <VersionHistoryPanel key={pageId ?? "closed"} pageId={pageId} />;
}

function VersionHistoryPanel({ pageId }: { pageId: string | null }) {
  const setPageId = useMainUi((s) => s.setHistoryPageId);
  const open = pageId !== null;
  const all = usePages((s) => s.pages);
  const page = pageId ? all[pageId] : undefined;
  useRestoreFocus(open);

  const [list, setList] = React.useState<{ status: VersionListStatus; versions: PageVersion[] }>({
    status: "loading",
    versions: [],
  });
  const [selected, setSelected] = React.useState<string | null>(null);
  const [shown, setShown] = React.useState<{ id: string; page?: Page; failed?: true } | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  React.useEffect(() => {
    if (!pageId) return;
    let alive = true;
    getStorage()
      .listVersions(pageId)
      .then((versions) => {
        if (!alive) return;
        setList({ status: versions.length ? "ready" : "empty", versions });
        setSelected(versions[0]?.id ?? null);
      })
      .catch(() => alive && setList({ status: "error", versions: [] }));
    return () => {
      alive = false;
    };
  }, [pageId]);

  React.useEffect(() => {
    if (!pageId || !selected) return;
    let alive = true;
    getStorage()
      .readVersion(pageId, selected)
      .then((p) => alive && setShown({ id: selected, page: p }))
      .catch(() => alive && setShown({ id: selected, failed: true }));
    return () => {
      alive = false;
    };
  }, [pageId, selected]);

  const groups = React.useMemo(() => groupVersions(list.versions, new Date()), [list.versions]);
  const current = shown && shown.id === selected ? shown : null;

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

  const preview = !selected ? null : current?.page ? (
    <NoteEditor
      key={current.id}
      content={current.page.content as JSONContent}
      editable={false}
      label={`${current.page.title || "제목 없음"} 버전 본문`}
      mentions={mentions}
      images={images}
      spellCheck={false}
    />
  ) : (
    <p role="status" className="text-ui text-tertiary">
      {current?.failed ? "이 버전을 읽지 못했어요." : "버전을 불러오는 중이에요."}
    </p>
  );

  const restore = async () => {
    if (!pageId || !selected || restoring) return;
    setRestoring(true);
    const outcome = await restoreVersion(
      {
        storage: getStorage(),
        pages: pagesStore,
        history: pagesStore.getState().history,
        onContentChanged: () => useMainUi.getState().bumpContent(),
      },
      pageId,
      selected,
    );
    setRestoring(false);
    if (!outcome.ok) {
      toast.error(REASON[outcome.reason]);
      return;
    }
    setPageId(null);
    toast(`“${outcome.title || "제목 없음"}” 버전으로 되돌렸어요.`, {
      action: {
        label: "실행 취소",
        onClick: () =>
          void outcome.undo().then((ok) => {
            if (!ok) toast.error("되돌리기를 취소하지 못했어요. 다시 해 보세요.");
          }),
      },
    });
  };

  return (
    <VersionHistory
      open={open && !!page}
      onOpenChange={(next) => {
        if (!next) setPageId(null);
      }}
      status={list.status}
      groups={groups}
      selectedId={selected}
      onSelect={setSelected}
      previewTitle={current?.page?.title ?? ""}
      preview={preview}
      restoring={restoring}
      onRestore={() => void restore()}
    />
  );
}
