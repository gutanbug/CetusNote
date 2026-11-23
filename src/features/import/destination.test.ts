import { describe, expect, it } from "vitest";
import type { Page } from "@/lib/storage";
import { importDestinations } from "./destination";

const page = (id: string, extra: Partial<Page> = {}): Page =>
  ({
    id,
    kind: "page",
    title: id,
    parentId: null,
    createdAt: "2026-11-23T00:00:00.000Z",
    ...extra,
  }) as Page;

describe("문서 가져오기 목적지 (DATA-08)", () => {
  it("맨 위가 맨 앞에 오고 트리 순서로 폴더·문서가 이어진다", () => {
    const pages = [page("a"), page("f", { kind: "folder" }), page("a1", { parentId: "a" })];
    expect(importDestinations(pages)).toEqual([null, "f", "a", "a1"]);
  });

  it("휴지통과 템플릿, 그 하위는 뺀다", () => {
    const pages = [
      page("live"),
      page("trash", { trashedAt: "2026-11-22T00:00:00.000Z" }),
      page("trashChild", { parentId: "trash" }),
      page("tpl", { template: { category: "회의록" } as Page["template"] }),
    ];
    expect(importDestinations(pages)).toEqual([null, "live"]);
  });

  it("컬렉션과 그 레코드는 뺀다", () => {
    const pages = [
      page("db", { kind: "collection" }),
      page("rec", { parentId: "db" }),
      page("note"),
    ];
    expect(importDestinations(pages)).toEqual([null, "note"]);
  });

  it("workspace.json 순서를 따른다", () => {
    const pages = [page("x"), page("y"), page("z")];
    expect(importDestinations(pages, { root: ["z", "x", "y"] })).toEqual([null, "z", "x", "y"]);
  });

  it("빈 워크스페이스에서도 맨 위만 돌려준다", () => {
    expect(importDestinations([])).toEqual([null]);
  });
});
