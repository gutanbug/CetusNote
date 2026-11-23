import { describe, expect, it } from "vitest";
import { filterSlashItems, groupSlashItems, SLASH_ITEMS } from "./slash-items";

const ids = (q: string) => filterSlashItems(q).map((it) => it.id);

describe("SLASH_ITEMS 데이터", () => {
  it("16개 항목, id는 서로 다르다", () => {
    expect(SLASH_ITEMS).toHaveLength(16);
    expect(new Set(SLASH_ITEMS.map((it) => it.id)).size).toBe(SLASH_ITEMS.length);
  });

  it("이름은 서로 다르고 설명·아이콘·낱말이 있다", () => {
    expect(new Set(SLASH_ITEMS.map((it) => it.title)).size).toBe(SLASH_ITEMS.length);
    for (const it of SLASH_ITEMS) {
      expect(it.title.trim(), it.id).not.toBe("");
      expect(it.description.trim(), it.id).not.toBe("");
      expect(it.icon, it.id).toBeTruthy();
      expect(it.keywords.length, it.id).toBeGreaterThan(0);
    }
  });

  it("그룹은 기본 블록 → 미디어 → 고급 순서로 이어진다(섞이지 않는다)", () => {
    const order = groupSlashItems(SLASH_ITEMS).map((g) => g.group);
    expect(order).toEqual(["기본 블록", "미디어", "고급"]);
    const flat = groupSlashItems(SLASH_ITEMS).flatMap((g) => g.items);
    expect(flat).toEqual(SLASH_ITEMS);
  });

  it("단축 입력(hint)은 서로 다르다", () => {
    const hints = SLASH_ITEMS.flatMap((it) => (it.hint ? [it.hint] : []));
    expect(new Set(hints).size).toBe(hints.length);
  });
});

describe("filterSlashItems", () => {
  it("빈 검색어·공백만 있으면 전부", () => {
    expect(filterSlashItems("")).toEqual(SLASH_ITEMS);
    expect(filterSlashItems("   ")).toEqual(SLASH_ITEMS);
  });

  it.each(SLASH_ITEMS.map((it) => [it.title, it.id] as const))(
    "이름 '%s'로 찾으면 %s가 나온다",
    (title, id) => {
      expect(ids(title)).toContain(id);
    },
  );

  it.each(SLASH_ITEMS.flatMap((it) => it.keywords.map((k) => [k, it.id] as const)))(
    "낱말 '%s'로 찾으면 %s가 나온다",
    (keyword, id) => {
      expect(ids(keyword)).toContain(id);
    },
  );

  it.each(SLASH_ITEMS.flatMap((it) => (it.hint ? [[it.hint, it.id] as const] : [])))(
    "단축 입력 '%s'로 찾으면 %s가 나온다",
    (hint, id) => {
      expect(ids(hint)).toContain(id);
    },
  );

  it("대소문자와 앞뒤 공백을 무시한다", () => {
    expect(ids("H1")).toEqual(["heading1"]);
    expect(ids("  TODO ")).toEqual(["taskList"]);
    expect(ids("LaTeX")).toEqual(["blockMath"]);
  });

  it("제목 검색은 제목 1·2·3, 단축 입력은 #의 개수로 좁혀진다", () => {
    expect(ids("제목")).toEqual(["heading1", "heading2", "heading3"]);
    expect(ids("#")).toEqual(["heading1", "heading2", "heading3"]);
    expect(ids("##")).toEqual(["heading2", "heading3"]);
    expect(ids("###")).toEqual(["heading3"]);
  });

  it("목록 검색은 목록 종류만 (원래 순서 유지)", () => {
    expect(ids("목록")).toEqual(["bulletList", "orderedList", "toggle"]);
    expect(ids("list")).toEqual(["bulletList", "orderedList", "taskList"]);
  });

  it("한국어 다른 이름으로도 찾는다", () => {
    expect(ids("할 일")).toEqual(["taskList"]);
    expect(ids("사진")).toEqual(["image"]);
    expect(ids("수학")).toEqual(["blockMath"]);
    expect(ids("링크")).toEqual(["pageMention"]);
    expect(ids("테이블")).toEqual(["table"]);
  });

  it("결과가 없으면 빈 배열", () => {
    expect(ids("데이터베이스")).toEqual([]);
    expect(ids("zzz")).toEqual([]);
  });

  it("결과는 늘 원래 목록의 순서를 따른다", () => {
    for (const q of ["e", "t", "l", "o", "코드", "선"]) {
      const got = filterSlashItems(q);
      const idx = got.map((it) => SLASH_ITEMS.indexOf(it));
      expect(idx, q).toEqual([...idx].sort((a, b) => a - b));
    }
  });

  it("다른 목록을 넘기면 그 안에서만 거른다", () => {
    const sub = SLASH_ITEMS.slice(0, 4);
    expect(filterSlashItems("제목", sub).map((it) => it.id)).toEqual([
      "heading1",
      "heading2",
      "heading3",
    ]);
    expect(filterSlashItems("표", sub)).toEqual([]);
  });
});
