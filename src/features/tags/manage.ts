import type { CollectionFilter, Page } from "@/lib/storage";

/**
 * 태그 관리 (SHELL-18) — 이름 바꾸기 · 합치기 · 색 바꾸기 · 삭제를 모든 페이지에 한 번에 적용하는 순수 계산.
 * 저장은 부르는 쪽이 한다(pages store + meta store). 여기서는 바뀔 값과 실행 취소 스냅샷만 만든다.
 *
 * 태그 이름 비교는 앱 전체와 같게 정확히 일치(대소문자 구분)로 한다.
 */

export type TagOp =
  | { kind: "rename"; from: string; to: string }
  | { kind: "merge"; from: string; into: string }
  | { kind: "recolor"; name: string; color: string }
  | { kind: "delete"; name: string };

/** 페이지 한 장의 바뀔 값. updatedAt은 이번 변경 시각(실행 취소 때는 이전 값) */
export type TagPagePatch = {
  props: Page["props"];
  collection: Page["collection"];
  updatedAt: string;
};

/** 실행 취소 스냅샷 — 바뀌기 전 값. 색은 바뀐 이름마다 이전 색(없었으면 null) */
export type TagUndo = {
  pages: Record<string, TagPagePatch>;
  colors: Record<string, string | null>;
};

export type TagPlan = {
  /** 바뀌는 페이지 (id → 새 값) */
  pages: Record<string, TagPagePatch>;
  /** 바뀐 뒤의 태그 색 전체 */
  colors: Record<string, string>;
  /** 태그가 바뀌는 페이지 수 */
  affected: number;
  /** 이름 바꾸기가 기존 태그와 겹쳐 합치기로 처리됐는지 (확인 문구·토스트용) */
  merged: boolean;
  undo: TagUndo;
};

export type TagPlanResult =
  { ok: true; plan: TagPlan } | { ok: false; reason: "empty" | "same" | "missing" | "self" };

/** 입력 이름 정리 — 앞뒤 공백을 뺀다 */
export function cleanTagName(name: string): string {
  return name.trim();
}

/** 이 이름을 쓰는 페이지가 있는가 (sidebar에 보이는 태그 기준) */
export function tagExists(pages: Record<string, Page>, name: string): boolean {
  for (const p of Object.values(pages)) if (p.props.tags.includes(name)) return true;
  return false;
}

/** 이 태그를 붙인 페이지 수 (휴지통·템플릿 포함 — 실제로 바뀌는 페이지 수와 같다) */
export function tagUsage(pages: Record<string, Page>, name: string): number {
  let n = 0;
  for (const p of Object.values(pages)) if (p.props.tags.includes(name)) n++;
  return n;
}

const TAG_KEY = "tags:";

/** 목록에서 from을 to로 바꾸고 중복을 뺀다(처음 나온 자리를 살린다). to가 null이면 지운다 */
function mapTags(tags: string[], from: string, to: string | null): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const next = t === from ? to : t;
    if (next !== null && !out.includes(next)) out.push(next);
  }
  return out;
}

/** 컬렉션 설정 안의 태그 이름(필터 값 · 보드 숨김 칸)을 같은 규칙으로 고친다. 바뀌지 않으면 원래 객체 그대로 */
function mapCollection(
  collection: Page["collection"],
  from: string,
  to: string | null,
): Page["collection"] {
  if (!collection) return collection;
  const filters: CollectionFilter[] = [];
  for (const f of collection.filters) {
    const hit = f.field === "tags" && f.value === from;
    const next = hit ? (to === null ? null : { field: f.field, value: to }) : f;
    if (!next) continue;
    if (!filters.some((x) => x.field === next.field && x.value === next.value)) filters.push(next);
  }
  const hiddenFrom = `${TAG_KEY}${from}`;
  const hidden: string[] = [];
  for (const key of collection.board.hidden) {
    const next = key === hiddenFrom ? (to === null ? null : `${TAG_KEY}${to}`) : key;
    if (next !== null && !hidden.includes(next)) hidden.push(next);
  }
  const same =
    filters.length === collection.filters.length &&
    filters.every((f, i) => f === collection.filters[i]) &&
    hidden.length === collection.board.hidden.length &&
    hidden.every((k, i) => k === collection.board.hidden[i]);
  if (same) return collection;
  return { ...collection, filters, board: { ...collection.board, hidden } };
}

/**
 * 태그 한 번의 변경을 계산한다.
 * - 이름 바꾸기: 새 이름이 이미 있으면 합치기로 바꾼다(merged). 색은 바꾼 쪽 색을 새 이름에 옮긴다(새 이름에 색이 있으면 그 색 유지).
 * - 합치기: 대상 색을 유지하고 원래 태그의 색은 버린다.
 * - 색 바꾸기: 페이지는 건드리지 않는다.
 * - 삭제: 모든 페이지에서 빼고 색도 버린다.
 */
export function planTagChange(
  pages: Record<string, Page>,
  colors: Record<string, string>,
  op: TagOp,
  now: string,
): TagPlanResult {
  let effective: TagOp = op;
  let merged = false;

  if (op.kind === "rename") {
    const to = cleanTagName(op.to);
    if (!to) return { ok: false, reason: "empty" };
    if (to === op.from) return { ok: false, reason: "same" };
    if (tagExists(pages, to)) {
      merged = true;
      effective = { kind: "merge", from: op.from, into: to };
    } else {
      effective = { kind: "rename", from: op.from, to };
    }
  } else if (op.kind === "merge") {
    if (op.into === op.from) return { ok: false, reason: "self" };
    if (!tagExists(pages, op.into)) return { ok: false, reason: "missing" };
  } else if (op.kind === "recolor") {
    if (!op.name) return { ok: false, reason: "empty" };
  } else {
    if (!op.name) return { ok: false, reason: "empty" };
  }

  // 색 계산 + 페이지 계산. 색 바꾸기는 페이지를 건드리지 않는다
  const nextColors = { ...colors };
  const undoColors: Record<string, string | null> = {};
  const remember = (name: string) => {
    if (!(name in undoColors)) undoColors[name] = colors[name] ?? null;
  };

  const from =
    effective.kind === "recolor"
      ? null
      : effective.kind === "delete"
        ? effective.name
        : effective.from;
  const to: string | null =
    effective.kind === "merge" ? effective.into : effective.kind === "rename" ? effective.to : null;

  if (effective.kind === "recolor") {
    remember(effective.name);
    nextColors[effective.name] = effective.color;
  } else if (effective.kind === "delete") {
    remember(effective.name);
    delete nextColors[effective.name];
  } else if (effective.kind === "merge") {
    remember(effective.from);
    delete nextColors[effective.from];
  } else {
    // rename: 새 이름에 색이 없으면 바꾼 쪽 색을 옮긴다
    remember(effective.from);
    remember(effective.to);
    const old = colors[effective.from];
    delete nextColors[effective.from];
    if (old !== undefined && colors[effective.to] === undefined) nextColors[effective.to] = old;
  }

  const patches: Record<string, TagPagePatch> = {};
  const undoPages: Record<string, TagPagePatch> = {};
  let affected = 0;
  if (from !== null) {
    for (const [id, p] of Object.entries(pages)) {
      const hasTag = p.props.tags.includes(from);
      const collection = mapCollection(p.collection, from, to);
      if (!hasTag && collection === p.collection) continue;
      if (hasTag) affected++;
      const tags = hasTag ? mapTags(p.props.tags, from, to) : p.props.tags;
      patches[id] = {
        props: { ...p.props, tags },
        collection,
        updatedAt: now,
      };
      undoPages[id] = { props: p.props, collection: p.collection, updatedAt: p.updatedAt };
    }
  }

  return {
    ok: true,
    plan: {
      pages: patches,
      colors: nextColors,
      affected,
      merged,
      undo: { pages: undoPages, colors: undoColors },
    },
  };
}

/** 실행 취소 — 스냅샷으로 되돌린 페이지 값과 태그 색 전체 */
export function undoTagChange(
  colors: Record<string, string>,
  undo: TagUndo,
): { pages: Record<string, TagPagePatch>; colors: Record<string, string> } {
  const next = { ...colors };
  for (const [name, color] of Object.entries(undo.colors)) {
    if (color === null) delete next[name];
    else next[name] = color;
  }
  return { pages: undo.pages, colors: next };
}
