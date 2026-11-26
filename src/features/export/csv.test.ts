import { describe, expect, it } from "vitest";
import type { Page } from "@/lib/storage";
import { collectionToCsv, csvCell } from "./csv";

const BOM = "﻿";

function record(over: Partial<Page> & { values?: Record<string, unknown> }): Page {
  const { values = {}, ...rest } = over;
  return {
    id: "r",
    title: "레코드",
    kind: "page",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    props: { status: "", assignee: "", due: "", tags: [], values },
    ...rest,
  } as unknown as Page;
}

const collection = {
  id: "c",
  title: "할 일",
  kind: "collection",
  collection: {
    fields: [
      { id: "f1", name: "우선순위", type: "text" },
      { id: "f2", name: "완료", type: "checkbox" },
      { id: "f3", name: "태그들", type: "multi" },
    ],
  },
} as unknown as Page;

describe("csvCell (RFC 4180)", () => {
  it("쉼표·큰따옴표·줄바꿈이 없으면 그대로", () => {
    expect(csvCell("그냥 텍스트")).toBe("그냥 텍스트");
  });
  it("쉼표·줄바꿈이 있으면 감싸고, 큰따옴표는 두 번 쓴다", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('말 "인용"')).toBe('"말 ""인용"""');
    expect(csvCell("첫 줄\n둘째 줄")).toBe('"첫 줄\n둘째 줄"');
  });
});

describe("collectionToCsv", () => {
  it("UTF-8 BOM으로 시작하고, 머리글은 고정 열 다음에 속성 이름", () => {
    const csv = collectionToCsv(collection, []);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1)).toBe("제목,상태,담당,마감,태그,우선순위,완료,태그들\r\n");
  });

  it("레코드 한 줄씩, 속성 값은 타입에 맞게 쓴다", () => {
    const rows = [
      record({
        title: "보고서, 최종",
        props: {
          status: "진행",
          assignee: "현민",
          due: "2026-12-01",
          tags: ["업무", "긴급"],
          values: { f1: "높음", f2: true, f3: ["a", "b"] },
        } as unknown as Page["props"],
      }),
      record({ title: "", props: { tags: [], values: { f2: false } } as unknown as Page["props"] }),
    ];
    const lines = collectionToCsv(collection, rows).slice(1).split("\r\n");
    expect(lines[1]).toBe('"보고서, 최종",진행,현민,2026-12-01,"업무, 긴급",높음,예,"a, b"');
    expect(lines[2]).toBe("제목 없음,,,,,,아니오,");
    expect(lines).toHaveLength(4); // 머리글 + 레코드 2 + 끝의 빈 줄
  });
});

describe("컬렉션 레코드 선택 (DATA-13)", () => {
  it("컬렉션 바로 아래 글만, 휴지통 제외, 제목 순으로 고른다", async () => {
    const { collectionRecords } = await import("./csv");
    const col = record({ id: "c", kind: "collection", title: "보드" });
    const all = {
      c: col,
      b: record({ id: "b", title: "나", parentId: "c" }),
      a: record({ id: "a", title: "가", parentId: "c" }),
      t: record({
        id: "t",
        title: "버림",
        parentId: "c",
        trashedAt: "2026-11-01T00:00:00.000Z" as Page["trashedAt"],
      }),
      o: record({ id: "o", title: "다른", parentId: "zz" }),
    };
    expect(collectionRecords("c", all).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
