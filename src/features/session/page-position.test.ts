import { describe, expect, it } from "vitest";
import {
  blockStartFor,
  clampSelection,
  forgetPositions,
  isDefaultPosition,
  markJump,
  pickRestore,
  POSITION_LIMIT,
  ratioOf,
  readPositions,
  rememberPosition,
  scrollTopFor,
  type PageSpot,
  wasJumpedTo,
} from "./page-position";

const pos = (block: number, anchor = block + 1, head = anchor) => ({
  block,
  ratio: 0.25,
  anchor,
  head,
});

describe("읽던 위치 — 기억·읽기 (PAGE-15)", () => {
  it("같은 페이지를 다시 기억하면 맨 뒤(가장 최근)로 옮긴다", () => {
    let list: PageSpot[] = [];
    list = rememberPosition(list, "a", pos(10));
    list = rememberPosition(list, "b", pos(20));
    list = rememberPosition(list, "a", pos(30));
    expect(list.map((s) => [s.id, s.block])).toEqual([
      ["b", 20],
      ["a", 30],
    ]);
  });

  it("LRU: 한도를 넘으면 가장 오래 안 쓴 페이지부터 버린다", () => {
    let list: PageSpot[] = [];
    for (let i = 0; i < POSITION_LIMIT + 5; i++) list = rememberPosition(list, `p${i}`, pos(i));
    expect(list).toHaveLength(POSITION_LIMIT);
    expect(list[0]!.id).toBe("p5");
    expect(list[list.length - 1]!.id).toBe(`p${POSITION_LIMIT + 4}`);
  });

  it("영구 삭제한 페이지의 위치를 지운다(없는 id는 그대로)", () => {
    const list = [
      { id: "a", ...pos(1) },
      { id: "b", ...pos(2) },
    ];
    expect(forgetPositions(list, ["a", "zzz"]).map((s) => s.id)).toEqual(["b"]);
    expect(forgetPositions(list, [])).toBe(list);
  });

  it("설정 파일이 깨져도 읽을 수 있는 것만 살린다: 잘못된 항목 버림, 같은 id는 뒤의 것 하나, 소수 버림", () => {
    const got = readPositions([
      { id: "a", block: 3.7, ratio: 0.5, anchor: 4, head: 4 },
      { id: "", block: 1, ratio: 0, anchor: 1, head: 1 },
      { id: "b", block: "x", ratio: 0, anchor: 1, head: 1 },
      null,
      { id: "a", block: 9, ratio: 0.1, anchor: 2, head: 3 },
      { id: "c", block: 1, ratio: Number.NaN, anchor: 1, head: 1 },
    ]);
    expect(got).toEqual([{ id: "a", block: 9, ratio: 0.1, anchor: 2, head: 3 }]);
    expect(readPositions("nope")).toEqual([]);
  });

  it("읽을 때도 한도를 지킨다(최근 것이 남는다)", () => {
    const raw = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      block: i,
      ratio: 0,
      anchor: 1,
      head: 1,
    }));
    expect(readPositions(raw, 2).map((s) => s.id)).toEqual(["p3", "p4"]);
  });
});

describe("위치 계산 — 블록과 비율 (화면 폭이 바뀌어도 같은 문단)", () => {
  it("블록 찾기: 위치가 속한 최상위 블록 시작, 첫 블록보다 앞이면 첫 블록, 빈 문서면 null", () => {
    const starts = [0, 10, 25, 40];
    expect(blockStartFor(starts, 0)).toBe(0);
    expect(blockStartFor(starts, 12)).toBe(10);
    expect(blockStartFor(starts, 40)).toBe(40);
    expect(blockStartFor(starts, 999)).toBe(40);
    expect(blockStartFor([], 5)).toBeNull();
  });

  it("비율은 블록 높이로 나누고, 높이가 0이면 0", () => {
    expect(ratioOf(50, 200)).toBe(0.25);
    expect(ratioOf(-40, 200)).toBe(-0.2);
    expect(ratioOf(10, 0)).toBe(0);
  });

  it("복원 스크롤 = 블록 콘텐츠 윗변 + 비율 × 높이, 음수는 0으로", () => {
    // 블록이 콘텐츠 800px 위치, 높이 200px, 선이 블록 위 50px(비율 0.25)
    expect(scrollTopFor(800, 0.25, 200)).toBe(850);
    expect(scrollTopFor(10, -0.5, 200)).toBe(0);
  });

  it("비율을 저장해 다시 쓰면 같은 자리로 돌아온다(왕복 항등)", () => {
    // 캡처: 스크롤 S0=640, 블록 콘텐츠 윗변 = 800, 높이 200, 화면 선 기준 블록 윗변 상대 = 800-640 = 160 → 선은 블록 위 -160px
    const offsetPx = 640 - 800; // 선 − 블록 윗변을 콘텐츠 좌표로 본 값 (화면 선 기준 0 가정)
    const ratio = ratioOf(offsetPx, 200);
    // 레이아웃이 달라져 블록 윗변이 1000으로 밀려도 같은 블록 안 같은 자리
    expect(scrollTopFor(1000, ratio, 200)).toBe(1000 - 160);
  });
});

describe("캐럿·선택 범위 — 바뀐 문서에 맞춘다", () => {
  it("범위 밖 위치는 [0, 문서 크기]로 자른다", () => {
    expect(clampSelection({ anchor: 500, head: -3 }, 20)).toEqual({ anchor: 20, head: 0 });
    expect(clampSelection({ anchor: 5, head: 7 }, 20)).toEqual({ anchor: 5, head: 7 });
  });
});

describe("복원 우선순위 (PAGE-15)", () => {
  const saved = pos(10);

  it("기본: 기억한 위치가 있으면 그대로 쓴다", () => {
    expect(pickRestore({ jumped: false, blank: false, saved })).toBe(saved);
  });

  it("검색 결과처럼 자리를 가리키며 열었으면 맨 위(복원 안 함)가 이긴다", () => {
    expect(pickRestore({ jumped: true, blank: false, saved })).toBeUndefined();
  });

  it("빈 페이지(새 페이지·템플릿 직후 빈 본문)는 기억이 있어도 맨 위 + 제목 포커스", () => {
    expect(pickRestore({ jumped: false, blank: true, saved })).toBeUndefined();
  });

  it("기억이 없으면 맨 위", () => {
    expect(pickRestore({ jumped: false, blank: false, saved: undefined })).toBeUndefined();
  });

  it("기본 상태(맨 위 + 문서 처음 캐럿)는 기억하지 않는다", () => {
    expect(isDefaultPosition({ atTop: true, anchor: 1, head: 1 })).toBe(true);
    expect(isDefaultPosition({ atTop: false, anchor: 1, head: 1 })).toBe(false);
    expect(isDefaultPosition({ atTop: true, anchor: 1, head: 30 })).toBe(false);
  });
});

describe("자리 지정 열기 표시 (검색 결과 등, 짧게 유효)", () => {
  it("표시한 페이지를 2초 안에 열면 참, 다른 페이지거나 시간이 지나면 거짓", async () => {
    const { vi } = await import("vitest");
    vi.useFakeTimers();
    try {
      markJump("p1");
      expect(wasJumpedTo("p1")).toBe(true);
      expect(wasJumpedTo("p1")).toBe(true); // 읽기만 한다
      expect(wasJumpedTo("p2")).toBe(false);
      vi.advanceTimersByTime(2001);
      expect(wasJumpedTo("p1")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
