import { usePagesWhile } from "@/features/pages";
import * as React from "react";
import { useMessages } from "@/lib/i18n";
import { ParentPicker } from "./parent-picker";
import { movePage, moveTargets } from "./actions";

/** 옮기기 (PAGE-05) — 갈 수 있는 곳만 보인다(컬렉션 아래에는 문서만 간다) */
export function MoveDialog({
  pageId,
  onOpenChange,
}: {
  pageId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const m = useMessages();
  const pages = usePagesWhile(pageId !== null);
  const targets = React.useMemo(
    () => (pageId ? moveTargets(pageId) : []),
    // pages가 바뀌면 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageId, pages],
  );

  return (
    <ParentPicker
      open={!!pageId}
      onOpenChange={onOpenChange}
      title={m.screens.dialogs.move.title}
      heading={m.screens.dialogs.move.heading}
      placeholder={m.screens.dialogs.move.placeholder}
      emptyText={m.screens.dialogs.move.empty}
      pages={pages}
      targets={targets}
      onPick={(parentId) => {
        if (pageId) movePage(pageId, parentId);
      }}
    />
  );
}
