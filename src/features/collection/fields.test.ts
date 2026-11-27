import { createPage, normalizeCollection, normalizePage, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import {
  addField,
  deleteField,
  fieldFilterChoices,
  fieldText,
  filterLabel,
  moveProperty,
  placeProperty,
  queryRecords,
  remapOption,
  renameField,
  setPropertySlot,
  withValue,
} from "./model";

const col = createPage({ kind: "collection", title: "업무" });
const rec = (title: string, values: Page["props"]["values"] = {}, extra: Partial<Page> = {}) => {
  const p = createPage({ title, parentId: col.id });
  return { ...p, props: { ...p.props, values }, ...extra };
};

describe("저장 형식 (스키마 5, COLL-07·08)", () => {
  it("옛 컬렉션은 속성 없음 + 기본 4개 순서 + 열기 방식은 기본값 따르기", () => {
    const s = normalizeCollection({ view: "grid" });
    expect(s.fields).toEqual([]);
    expect(s.properties.map((p) => p.key)).toEqual(["status", "assignee", "due", "tags"]);
    expect(s.openMode).toBeNull();
  });

  it("모르는 키·잘못된 id·겹친 옵션은 버리고, 빠진 속성은 순서 끝에 붙인다", () => {
    const s = normalizeCollection({
      fields: [
        { id: "fabcd1234", name: " 금액 ", type: "number", options: [{ name: "x" }] },
        { id: "status", name: "가짜", type: "text" },
        { id: "fsel00001", name: "단계", type: "select", options: [{ name: "A" }, { name: "A" }] },
        { id: "fwhat0001", name: "", type: "nope" },
      ],
      properties: [{ key: "fsel00001", hidden: true }, { key: "due" }, { key: "zzz" }],
      openMode: "side",
      filters: [
        { field: "fsel00001", value: "A" },
        { field: "fgone0001", value: "B" },
      ],
      sort: { field: "fabcd1234", dir: "desc" },
    });
    expect(s.fields).toEqual([
      { id: "fabcd1234", name: "금액", type: "number", options: [] },
      { id: "fsel00001", name: "단계", type: "select", options: [{ name: "A", color: "gray" }] },
      { id: "fwhat0001", name: "속성", type: "text", options: [] },
    ]);
    expect(s.properties.map((p) => `${p.key}${p.hidden ? "(숨김)" : ""}`)).toEqual([
      "fsel00001(숨김)",
      "due",
      "status",
      "assignee",
      "tags",
      "fabcd1234",
      "fwhat0001",
    ]);
    expect(s.openMode).toBe("side");
    expect(s.filters).toEqual([{ field: "fsel00001", value: "A" }]);
    expect(s.sort).toEqual({ field: "fabcd1234", dir: "desc" });
  });

  it("레코드 값은 사용자 속성 id 키와 맞는 모양만 남긴다 (스키마 4 파일은 빈 값)", () => {
    const old = normalizePage({ schemaVersion: 4, id: col.id, props: { status: "할 일" } });
    expect(old.props.values).toEqual({});
    const p = normalizePage({
      schemaVersion: 5,
      id: col.id,
      props: {
        values: {
          fabcd1234: 12.5,
          fsel00001: "A",
          fmul00001: ["x", "x", 3, "y"],
          fchk00001: true,
          fnan00001: Number.NaN,
          status: "몰래",
          fempty001: "",
        },
      },
    });
    expect(p.props.values).toEqual({
      fabcd1234: 12.5,
      fsel00001: "A",
      fmul00001: ["x", "y"],
      fchk00001: true,
    });
  });
});

describe("사용자 속성 (COLL-08)", () => {
  const base = normalizeCollection(null);

  it("더하면 종류 이름으로 이름을 짓고 겹치면 번호를 붙인다", () => {
    const a = addField(base, "text")!;
    const s1 = { ...base, ...a.patch };
    const b = addField(s1, "text")!;
    const s2 = { ...s1, ...b.patch };
    expect(s2.fields.map((f) => f.name)).toEqual(["텍스트", "텍스트 2"]);
    expect(s2.properties[s2.properties.length - 1]).toEqual({
      key: b.id,
      hidden: false,
      card: false,
    });
    expect(a.id).toMatch(/^f[a-z0-9]{8}$/);
  });

  it("이름 바꾸기 — 빈 이름·기본 속성 이름·다른 속성 이름은 거절", () => {
    const a = addField(base, "number")!;
    const s = { ...base, ...a.patch };
    expect(renameField(s, a.id, "  ")).toBeNull();
    expect(renameField(s, a.id, "상태")).toBeNull();
    expect(renameField(s, a.id, "금액")!.fields[0]!.name).toBe("금액");
  });

  it("지우면 순서·필터·정렬에서도 빠진다", () => {
    const a = addField(base, "select")!;
    const s = {
      ...base,
      ...a.patch,
      filters: [
        { field: a.id, value: "A" },
        { field: "status" as const, value: "할 일" },
      ],
      sort: { field: a.id, dir: "asc" as const },
    };
    const out = deleteField(s, a.id);
    expect(out.fields).toEqual([]);
    expect(out.properties.some((p) => p.key === a.id)).toBe(false);
    expect(out.filters).toEqual([{ field: "status", value: "할 일" }]);
    expect(out.sort).toBeNull();
  });

  it("순서 옮기기는 숨긴 속성을 건너뛴다", () => {
    const s = { ...base, ...setPropertySlot(base, "assignee", { hidden: true }) };
    expect(moveProperty(s, "due", -1)!.properties.map((p) => p.key)).toEqual([
      "due",
      "assignee",
      "status",
      "tags",
    ]);
    expect(moveProperty(s, "status", -1)).toBeNull();
  });

  it("끌어 놓기는 지정한 줄 앞(또는 맨 끝)에 넣고, 제자리면 null", () => {
    const keys = (s: { properties: { key: string }[] } | null) => s?.properties.map((p) => p.key);
    expect(keys(placeProperty(base, "status", "tags"))).toEqual([
      "assignee",
      "due",
      "status",
      "tags",
    ]);
    expect(keys(placeProperty(base, "tags", "assignee"))).toEqual([
      "status",
      "tags",
      "assignee",
      "due",
    ]);
    expect(keys(placeProperty(base, "assignee", null))).toEqual([
      "status",
      "due",
      "tags",
      "assignee",
    ]);
    expect(placeProperty(base, "due", "tags")).toBeNull();
    expect(placeProperty(base, "tags", null)).toBeNull();
    expect(placeProperty(base, "due", "due")).toBeNull();
  });

  it("값 고치기 — 빈 값은 키를 뺀다", () => {
    const p = rec("가").props;
    const set = withValue(p, "fabcd1234", 3);
    expect(set.values).toEqual({ fabcd1234: 3 });
    expect(withValue(set, "fabcd1234", null).values).toEqual({});
    expect(withValue(set, "fchk00001", false).values).toEqual({ fabcd1234: 3 });
  });

  it("값을 글로", () => {
    const f = (type: Parameters<typeof fieldText>[0]["type"]) => ({
      id: "fabcd1234" as const,
      name: "x",
      type,
      options: [],
    });
    expect(fieldText(f("number"), 1234567.5)).toBe("1,234,567.5");
    expect(fieldText(f("checkbox"), true)).toBe("체크됨");
    expect(fieldText(f("checkbox"), false)).toBe("");
    expect(fieldText(f("multi"), ["a", "b"])).toBe("a, b");
    expect(fieldText(f("date"), "2026-12-25", "2026-11-20")).toBe("12월 25일");
    expect(fieldText(f("text"), null)).toBe("");
  });

  it("옵션 이름을 바꾸거나 지우면 레코드 값도 고친다", () => {
    const sel = { id: "fsel00001" as const, name: "단계", type: "select" as const, options: [] };
    const mul = { id: "fmul00001" as const, name: "분류", type: "multi" as const, options: [] };
    const records = [
      rec("가", { fsel00001: "A", fmul00001: ["A", "B"] }),
      rec("나", { fsel00001: "B" }),
    ];
    expect(remapOption(records, sel, "A", "에이")).toEqual([{ id: records[0]!.id, value: "에이" }]);
    expect(remapOption(records, mul, "A", null)).toEqual([{ id: records[0]!.id, value: ["B"] }]);
    expect(remapOption(records, mul, "A", "B")).toEqual([{ id: records[0]!.id, value: ["B"] }]);
  });

  it("필터·검색·정렬에 사용자 속성이 들어간다", () => {
    const sel = {
      id: "fsel00001" as const,
      name: "단계",
      type: "select" as const,
      options: [{ name: "A", color: "gray" }],
    };
    const chk = { id: "fchk00001" as const, name: "확인", type: "checkbox" as const, options: [] };
    const num = { id: "fnum00001" as const, name: "금액", type: "number" as const, options: [] };
    const txt = { id: "ftxt00001" as const, name: "메모", type: "text" as const, options: [] };
    const fields = [sel, chk, num, txt];
    const a = rec("가", { fsel00001: "A", fnum00001: 30, ftxt00001: "회의실 예약" });
    const b = rec("나", { fchk00001: true, fnum00001: 5 });
    const c = rec("다", { fsel00001: "A", fchk00001: true });
    const all = [a, b, c];
    const q = (filters: { field: never; value: string }[], search = "", sort = null as never) =>
      queryRecords(all, { filters, sort, fields }, search).map((p) => p.title);
    expect(q([{ field: "fsel00001" as never, value: "A" }])).toEqual(["가", "다"]);
    expect(
      q([
        { field: "fsel00001" as never, value: "A" },
        { field: "fchk00001" as never, value: "true" },
      ]),
    ).toEqual(["다"]);
    expect(q([{ field: "fchk00001" as never, value: "false" }])).toEqual(["가"]);
    expect(q([], "회의실")).toEqual(["가"]);
    // 빈 값은 방향과 관계없이 뒤로
    expect(q([], "", { field: "fnum00001", dir: "desc" } as never)).toEqual(["가", "나", "다"]);
    expect(q([], "", { field: "fnum00001", dir: "asc" } as never)).toEqual(["나", "가", "다"]);
    expect(fieldFilterChoices(fields).map((c) => [c.name, c.values.map((v) => v.label)])).toEqual([
      ["단계", ["A"]],
      ["확인", ["체크됨", "체크 안 됨"]],
    ]);
    expect(filterLabel({ field: "fchk00001", value: "false" }, fields)).toBe("확인: 체크 안 됨");
    expect(filterLabel({ field: "status", value: "할 일" })).toBe("상태: 할 일");
  });
});
