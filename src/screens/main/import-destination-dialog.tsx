import { importDestinations } from "@/features/import/destination";
import { useMeta } from "@/features/meta";
import { usePagesWhile } from "@/features/pages";
import * as React from "react";
import {
  answerImportDestination,
  cancelImportDestination,
  useImportDestination,
} from "./import-destination";
import { ParentPicker } from "./parent-picker";
import { useMessages } from "@/lib/i18n";

/** 문서 가져오기 목적지 고르기 (DATA-08) — 메인 화면에 하나만 둔다 */
export function ImportDestinationDialog() {
  const m = useMessages();
  const pending = useImportDestination((s) => s.pending);
  const pages = usePagesWhile(pending !== null);
  const order = useMeta((s) => s.meta?.order);
  const targets = React.useMemo(
    () =>
      importDestinations(Object.values(pages), order)
        .filter((id) => id === null || !!pages[id])
        .map((id) => (id === null ? null : pages[id]!)),
    [pages, order],
  );

  return (
    <ParentPicker
      open={!!pending}
      onOpenChange={(o) => !o && cancelImportDestination()}
      title={m.settings.importFile.destTitle(pending?.count ?? 0)}
      heading={m.settings.importFile.destHeading}
      placeholder={m.settings.importFile.destPlaceholder}
      emptyText={m.settings.importFile.destEmpty}
      pages={pages}
      targets={targets}
      onPick={(parentId) => answerImportDestination(parentId)}
    />
  );
}
