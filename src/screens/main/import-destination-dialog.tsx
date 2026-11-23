import { importDestinations } from "@/features/import/destination";
import { useMeta } from "@/features/meta";
import { usePages } from "@/features/pages";
import * as React from "react";
import {
  answerImportDestination,
  cancelImportDestination,
  useImportDestination,
} from "./import-destination";
import { ParentPicker } from "./parent-picker";

/** 문서 가져오기 목적지 고르기 (DATA-08) — 메인 화면에 하나만 둔다 */
export function ImportDestinationDialog() {
  const pending = useImportDestination((s) => s.pending);
  const pages = usePages((s) => s.pages);
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
      title={`문서 ${pending?.count ?? 0}개 가져오기`}
      heading="어디에 넣을까요?"
      placeholder="넣을 폴더나 페이지 검색"
      emptyText="넣을 수 있는 곳이 없어요."
      pages={pages}
      targets={targets}
      onPick={(parentId) => answerImportDestination(parentId)}
    />
  );
}
