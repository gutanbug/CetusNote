/**
 * 읽던 위치 (PAGE-15) — 페이지마다 스크롤 위치와 캐럿(선택 범위)을 기억한다.
 *
 * 스크롤은 픽셀이 아니라 "맨 위에 걸친 최상위 블록 + 그 블록 안 비율"로 적는다.
 * 창 폭·화면 배율(SHELL-17)이 바뀌면 줄바꿈이 달라져 픽셀 값은 엉뚱한 곳에 닿지만,
 * 블록 위치는 같은 문단을 가리킨다. 블록 안 비율로 그 문단 안의 위치를 잡는다.
 * 위치는 페이지 파일에 넣지 않고 워크스페이스별 settings.json에 둔다(architecture §3).
 */
export type PagePosition = {
  /** 맨 위에 걸친 최상위 블록의 문서 위치 */
  block: number;
  /**
   * 화면 맨 위 선이 블록 위쪽에서 블록 높이의 몇 배만큼 떨어졌는지.
   * 0이면 블록 맨 위, 0.5면 블록 가운데, 음수면 블록이 아직 화면 아래(머리 영역 위).
   */
  ratio: number;
  /** 선택 범위 — 문서 위치 (anchor = 시작점, head = 캐럿) */
  anchor: number;
  head: number;
};

/** 기억하는 페이지 수 (가장 오래 안 연 것부터 버린다) */
export const POSITION_LIMIT = 200;

/** 저장 형식: 최근에 쓴 것이 뒤. 객체 키 순서 대신 배열로 둔다(ID 순서 보장) */
export type PageSpot = PagePosition & { id: string };

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** 설정 파일에서 읽는다. 깨진 항목은 버리고, 같은 페이지는 뒤의 것 하나만 남긴다 */
export function readPositions(raw: unknown, limit = POSITION_LIMIT): PageSpot[] {
  if (!Array.isArray(raw)) return [];
  const out: PageSpot[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id) continue;
    if (!finite(o.block) || !finite(o.ratio) || !finite(o.anchor) || !finite(o.head)) continue;
    out.push({
      id: o.id,
      block: Math.max(0, Math.floor(o.block)),
      ratio: o.ratio,
      anchor: Math.max(0, Math.floor(o.anchor)),
      head: Math.max(0, Math.floor(o.head)),
    });
  }
  const last = new Map<string, PageSpot>();
  for (const s of out) {
    last.delete(s.id);
    last.set(s.id, s);
  }
  return [...last.values()].slice(-limit);
}

export function findPosition(list: PageSpot[], id: string): PagePosition | undefined {
  const s = list.find((x) => x.id === id);
  return s ? { block: s.block, ratio: s.ratio, anchor: s.anchor, head: s.head } : undefined;
}

/** 이 페이지를 가장 최근으로 기억한다(같은 페이지는 옮겨 적고, 넘치면 가장 오래된 것부터 뺀다) */
export function rememberPosition(
  list: PageSpot[],
  id: string,
  pos: PagePosition,
  limit = POSITION_LIMIT,
): PageSpot[] {
  return [...list.filter((s) => s.id !== id), { id, ...pos }].slice(-limit);
}

/** 영구 삭제한 페이지의 위치를 지운다 */
export function forgetPositions(list: PageSpot[], ids: readonly string[]): PageSpot[] {
  if (!ids.length) return list;
  const drop = new Set(ids);
  return list.filter((s) => !drop.has(s.id));
}

/**
 * 문서 위치가 문서 크기 안에 들어오게 한다. 바뀐 문서에 옛 위치를 적용할 때 쓴다.
 * 범위는 [0, size]. 블록 위치는 호출하는 쪽이 최상위 블록 시작으로 다시 맞춘다.
 */
export function clampSelection(
  pos: Pick<PagePosition, "anchor" | "head">,
  size: number,
): { anchor: number; head: number } {
  const c = (n: number) => Math.min(Math.max(0, n), Math.max(0, size));
  return { anchor: c(pos.anchor), head: c(pos.head) };
}

/**
 * 블록 시작 위치 목록(오름차순)에서 pos가 속한 블록의 시작 위치를 고른다.
 * pos가 첫 블록보다 앞이면 첫 블록, 목록이 비었으면 null.
 */
export function blockStartFor(starts: readonly number[], pos: number): number | null {
  if (!starts.length) return null;
  let found = starts[0]!;
  for (const s of starts) {
    if (s <= pos) found = s;
    else break;
  }
  return found;
}

/**
 * 비율 계산. 블록 높이가 0 이하면(빈 블록 측정 실패) 0을 준다.
 * offsetPx = 화면 맨 위 선 − 블록 윗변 (px). 복원할 때는 같은 식의 역연산을 쓴다.
 */
export function ratioOf(offsetPx: number, heightPx: number): number {
  return heightPx > 0 && Number.isFinite(offsetPx) ? offsetPx / heightPx : 0;
}

/** 복원할 스크롤 위치(px): 블록의 콘텐츠 기준 윗변 + 비율 × 높이 */
export function scrollTopFor(blockContentTop: number, ratio: number, heightPx: number): number {
  return Math.max(0, blockContentTop + ratio * Math.max(0, heightPx));
}

/**
 * 복원 우선순위 (PAGE-15). 위에서부터 이긴다.
 * 1) 명시적으로 어딘가를 가리키며 연 경우(검색 결과 등) — 맨 위에서 시작한다.
 * 2) 빈 페이지(방금 만든 새 페이지·템플릿 적용 직후 빈 본문) — 맨 위 + 제목에 포커스(기존 동작).
 * 3) 기억한 위치가 있으면 그대로.
 * 헤딩 목차·찾기 점프는 이미 열린 화면에서 일어나므로 복원 대상이 아니다.
 */
export function pickRestore(input: {
  jumped: boolean;
  blank: boolean;
  saved: PagePosition | undefined;
}): PagePosition | undefined {
  if (input.jumped || input.blank) return undefined;
  return input.saved;
}

/** 맨 위에서 캐럿이 문서 처음이면 기본 상태 — 기억을 지운다(목록을 가볍게 둔다) */
export function isDefaultPosition(p: { atTop: boolean; anchor: number; head: number }): boolean {
  return p.atTop && p.anchor <= 1 && p.head <= 1;
}

/**
 * 검색 결과처럼 특정 자리를 가리키며 여는 직전에 부른다. 그 열기는 맨 위에서 시작한다.
 * 짧은 시간(2초) 안의 열기에만 효력이 있어, 표시만 남고 열리지 않은 경우가 오래 가지 않는다.
 */
const JUMP_TTL_MS = 2000;
let jump: { id: string; at: number } | null = null;
export function markJump(pageId: string) {
  jump = { id: pageId, at: Date.now() };
}
/** 방금 이 페이지를 자리 지정으로 열었나. 읽기만 한다(같은 열기 안에서 여러 번 불러도 같다) */
export function wasJumpedTo(pageId: string): boolean {
  return !!jump && jump.id === pageId && Date.now() - jump.at <= JUMP_TTL_MS;
}
