import { describe, expect, it } from "vitest";
import { pageMenuSections } from "./page-menu-model";

describe("페이지 메뉴 종류별 항목 (DATA-13)", () => {
  it("컬렉션에는 CSV 내보내기가 보이고 문서 도구는 안 보인다", () => {
    expect(pageMenuSections("collection")).toEqual({ doc: false, csv: true });
  });
  it("문서에는 CSV 내보내기가 없다", () => {
    expect(pageMenuSections("page")).toEqual({ doc: true, csv: false });
  });
});
