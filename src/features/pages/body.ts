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

/**
 * 같은 값인가. 값이 null인 키는 없는 것과 같게 본다 — 에디터가 열 때 노드 기본 속성(`textAlign: null`)을
 * 채워 넣는 것은 편집이 아니므로 저장·버전 기록·updatedAt 갱신을 일으키지 않는다.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      const x = canonical((v as Record<string, unknown>)[k]);
      // 빈 값·빈 객체(`attrs: { textAlign: null }` → `{}`)는 없는 것과 같다
      if (x === null || (typeof x === "object" && Object.keys(x as object).length === 0)) continue;
      out[k] = x;
    }
    return out;
  }
  return v ?? null;
}
