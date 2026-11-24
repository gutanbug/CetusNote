import * as React from "react";
import type { Page } from "@/lib/storage";
import { pageTodos, type TodoRef } from "@/features/todos/todos";
import { collectReminders, type DateReminder } from "@/lib/dates/collect-reminders";
import { assetRefs } from "./assets";
import { backlinksFrom, linksOf, type Backlink, type LinkHit } from "./backlinks";

/**
 * 본문에서 미리 뽑아 둔 것 (SYS-10, ADR-022). 백링크·홈 할 일·표지 그림은 본문 전체 없이 이것만 본다.
 * 검색 색인과 같은 백그라운드 읽기가 채우고, 열린 페이지를 고치면 유휴 시간에 다시 뽑는다.
 */
export type PageSummary = {
  /** 이 페이지가 언급한 페이지 id → 언급 (백링크) */
  links: Map<string, LinkHit>;
  /** 체크리스트 항목, 체크한 것 포함 (홈 할 일) */
  todos: TodoRef[];
  /** 첫 그림 경로 (표지가 없을 때 홈 카드가 쓴다) */
  asset: string | null;
  /** 알림이 켜진 날짜 칩 (EDIT-37). 앱 시작 때 알림 스케줄러가 본문 없이 이것만 본다 */
  reminders: DateReminder[];
};

/** 본문 하나에서 요약을 뽑는다. titleOf는 멘션 칩 글에 쓴다 */
export function summarizePage(
  page: Pick<Page, "id" | "content">,
  titleOf: (id: string) => string | undefined = () => undefined,
): PageSummary {
  return {
    links: linksOf(page, titleOf),
    todos: pageTodos(page),
    asset: assetRefs({ cover: null, icon: null, content: page.content })[0] ?? null,
    reminders: collectReminders(page.content, page.id),
  };
}

/** 요약 색인. 값을 넣거나 지우면 버전이 올라가고 구독자에게 알린다 */
export function createSummaryIndex() {
  const byId = new Map<string, PageSummary>();
  let version = 0;
  const listeners = new Set<() => void>();
  const bump = () => {
    version++;
    for (const l of listeners) l();
  };
  return {
    get: (id: string): PageSummary | undefined => byId.get(id),
    /** 여러 개를 한 번에 넣는다 (한 번만 알린다) */
    setMany(entries: [string, PageSummary][]) {
      if (!entries.length) return;
      for (const [id, s] of entries) byId.set(id, s);
      bump();
    },
    remove(id: string) {
      if (byId.delete(id)) bump();
    },
    clear() {
      if (byId.size) {
        byId.clear();
        bump();
      }
    },
    /** 요약이 있는 페이지 전부 */
    entries: () => byId.entries(),
    get size() {
      return byId.size;
    },
    get version() {
      return version;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type SummaryIndex = ReturnType<typeof createSummaryIndex>;

/** 앱 전체의 본문 요약 (SYS-10). features/search/index.ts가 백그라운드 읽기로 채운다 */
export const summaryIndex = createSummaryIndex();

/** 요약 색인이 바뀌면 다시 그리게 한다. 값은 버전 번호다 */
export function useSummaryVersion(index: SummaryIndex = summaryIndex): number {
  return React.useSyncExternalStore(
    (listener) => index.subscribe(listener),
    () => index.version,
  );
}

/**
 * 백링크 — 요약으로 만든다. 본문을 읽지 않은 페이지는 아직 빠진다 (백그라운드 읽기가 끝나면 모두 든다).
 * 결과는 findBacklinks와 같다(최근에 고친 페이지가 앞).
 */
export function backlinksIn(
  id: string,
  pages: Record<string, Page>,
  index: SummaryIndex = summaryIndex,
): Backlink[] {
  const sources: { page: Page; links: Map<string, LinkHit> }[] = [];
  for (const page of Object.values(pages)) {
    const s = index.get(page.id);
    if (s) sources.push({ page, links: s.links });
  }
  return backlinksFrom(id, sources);
}

/**
 * 홈의 열린 할 일 — 최근에 고친 문서부터, 문서 안에서는 위에서부터 (todos.openTodos와 같은 규칙).
 * 요약이 아직 없는 문서의 할 일은 빠진다.
 */
export function openTodosIn(
  pages: { id: string; updatedAt: string }[],
  index: SummaryIndex = summaryIndex,
): TodoRef[] {
  return [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .flatMap((p) => index.get(p.id)?.todos ?? [])
    .filter((t) => !t.checked && t.text);
}
