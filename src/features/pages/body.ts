import type { DocJSON, Page } from "@/lib/storage";

/**
 * 본문을 아직 읽지 않은 페이지의 자리 값 (SYS-10, ADR-022). 시작할 때는 구조만 읽고 본문은 열 때 읽는다.
 * 값이 같아도 다른 객체면 읽은 본문이므로, 판단은 객체 참조로 한다.
 */
export const UNLOADED_BODY = Object.freeze({
  type: "doc" as const,
  content: [] as unknown[],
}) as unknown as DocJSON;

export const isBodyLoaded = (page: Pick<Page, "content">): boolean =>
  page.content !== UNLOADED_BODY;
