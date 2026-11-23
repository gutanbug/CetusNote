/** 분할 화면(SHELL-19) 저장 값 — 오른쪽 패널의 페이지와 폭. 워크스페이스마다 session 설정에 쓴다 */
export type SplitState = { pageId: string | null; width: number | null };

/** 저장된 값을 읽는다. 잘못된 값은 버린다 */
export function readSplit(raw: unknown): SplitState {
  if (typeof raw !== "object" || raw === null) return { pageId: null, width: null };
  const r = raw as Record<string, unknown>;
  return {
    pageId: typeof r.pageId === "string" && r.pageId.length > 0 ? r.pageId : null,
    width: typeof r.width === "number" && Number.isFinite(r.width) ? r.width : null,
  };
}
