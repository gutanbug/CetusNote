import { describe, expect, it } from "vitest";
import { collapsePath } from "./breadcrumb-path";

const path = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe("collapsePath (SH-Breadcrumb · ED-Breadcrumb 공용)", () => {
  it("빈 경로와 한 단계는 그대로 둔다", () => {
    expect(collapsePath([], 4)).toEqual({ shown: [], hidden: [] });
    expect(collapsePath(["only"], 4)).toEqual({ shown: ["only"], hidden: [] });
  });

  it("maxItems 이하면 접지 않는다", () => {
    expect(collapsePath(path(4), 4)).toEqual({ shown: path(4), hidden: [] });
  });

  it("길면 처음 + … + 마지막 (maxItems-2)개를 보이고 가운데를 숨긴다", () => {
    const r = collapsePath(path(6), 4);
    expect(r.shown).toEqual(["p0", "more", "p4", "p5"]);
    expect(r.hidden).toEqual(["p1", "p2", "p3"]);
  });

  it("숨긴 항목은 위에서 아래 순서를 지킨다", () => {
    const r = collapsePath(path(10), 4);
    expect(r.hidden).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(r.shown[r.shown.length - 1]).toBe("p9");
  });

  it("처음과 현재 항목은 항상 보인다", () => {
    for (const n of [5, 8, 20]) {
      const { shown } = collapsePath(path(n), 4);
      expect(shown[0]).toBe("p0");
      expect(shown[shown.length - 1]).toBe(`p${n - 1}`);
    }
  });

  it("maxItems가 3보다 작아도 최소 3으로 올려 처음·…·현재를 지킨다", () => {
    const r = collapsePath(path(5), 1);
    expect(r.shown).toEqual(["p0", "more", "p4"]);
    expect(r.hidden).toEqual(["p1", "p2", "p3"]);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const items = path(6);
    collapsePath(items, 4);
    expect(items).toEqual(path(6));
  });
});
