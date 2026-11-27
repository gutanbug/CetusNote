import { createPage, normalizeCollection, type CollectionSettings, type Page } from "@/lib/storage";
import { describe, expect, it } from "vitest";
import {
  boardGroups,
  groupCalc,
  groupProps,
  moveProps,
  newStatusName,
  nextColor,
  reorder,
  checklistProgress,
  collectionRecords,
  filterChoices,
  formatDue,
  monthGrid,
  queryRecords,
  deleteField,
  mapViewQueries,
  viewQuery,
  withViewQuery,
} from "./model";

const col = createPage({ kind: "collection", title: "업무" });
const rec = (
  title: string,
  props: Partial<Page["props"]> = {},
  extra: Partial<Page> = {},
): Page => ({
  ...createPage({ title, parentId: col.id }),
  props: { tags: [], status: null, assignee: null, start: null, due: null, values: {}, ...props },
  ...extra,
});

describe("컬렉션 (COLL-01~06)", () => {
  it("레코드: 휴지통·다른 부모는 빼고 order 순서", () => {
    const a = rec("가");
    const b = rec("나");
    const t = rec("지움", {}, { trashedAt: "2026-11-20T00:00:00.000Z" });
    const other = { ...createPage({ title: "밖" }) };
    const pages = Object.fromEntries([col, a, b, t, other].map((p) => [p.id, p]));
    expect(collectionRecords(pages, col.id, [b.id]).map((p) => p.title)).toEqual(["나", "가"]);
  });

  it("필터: 같은 필드는 또는, 다른 필드는 그리고 · 검색 · 정렬(빈 값은 뒤)", () => {
    const list = [
      rec("스프린트 리뷰", { status: "진행 중", assignee: "차민석", due: "2026-11-24" }),
      rec("온보딩 문서", { status: "검토", assignee: "이지후", due: "2026-11-21", tags: ["문서"] }),
      rec("접근성 점검", { status: "할 일", tags: ["기획"] }),
      rec("릴리스 노트", { status: "진행 중", assignee: "박세연", due: "2026-11-02" }),
    ];
    const titles = (ps: Page[]) => ps.map((p) => p.title);
    expect(
      titles(
        queryRecords(list, {
          sort: { field: "due", dir: "asc" },
          filters: [
            { field: "status", value: "진행 중" },
            { field: "status", value: "검토" },
          ],
        }),
      ),
    ).toEqual(["릴리스 노트", "온보딩 문서", "스프린트 리뷰"]);
    expect(
      titles(
        queryRecords(list, {
          sort: null,
          filters: [
            { field: "status", value: "진행 중" },
            { field: "assignee", value: "차민석" },
          ],
        }),
      ),
    ).toEqual(["스프린트 리뷰"]);
    expect(titles(queryRecords(list, { sort: null, filters: [] }, "문서"))).toEqual([
      "온보딩 문서",
    ]);
    const desc = titles(queryRecords(list, { sort: { field: "due", dir: "desc" }, filters: [] }));
    expect(desc[desc.length - 1]).toBe("접근성 점검");
    expect(filterChoices(list).assignee).toEqual(["박세연", "이지후", "차민석"]);
  });

  it("보드 칸: 상태 목록 순, 상태 없음·목록 밖은 '상태 없음' 칸(있을 때만)", () => {
    const statuses = [
      { name: "할 일", color: "gray" },
      { name: "완료", color: "green" },
    ];
    const opts = { groupBy: "status" as const, statuses, colors: {}, tagColors: {} };
    const g = boardGroups(
      [rec("가"), rec("나", { status: "완료" }), rec("다", { status: "보류" })],
      opts,
    );
    expect(g.map((x) => [x.label, x.records.map((p) => p.title)])).toEqual([
      ["상태 없음", ["가", "다"]],
      ["할 일", []],
      ["완료", ["나"]],
    ]);
    expect(g[2]!.color).toBe("green");
    expect(boardGroups([rec("나", { status: "완료" })], opts).map((x) => x.label)).toEqual([
      "할 일",
      "완료",
    ]);
  });

  it("보드 칸: 태그는 칸마다 보이고, 옮기면 그 태그만 바뀐다", () => {
    const r = rec("가", { tags: ["회의", "기획"] });
    const g = boardGroups([r], {
      groupBy: "tags",
      statuses: [],
      colors: {},
      tagColors: { 회의: "blue" },
    });
    expect(g.map((x) => x.label)).toEqual(["기획", "회의"]);
    expect(g[1]!.color).toBe("blue");
    expect(moveProps(r, "tags", "회의", "문서")).toEqual({ tags: ["기획", "문서"] });
    expect(moveProps(r, "tags", "회의", null)).toEqual({ tags: ["기획"] });
    expect(moveProps(r, "assignee", null, "차민석")).toEqual({ assignee: "차민석" });
    expect(moveProps(r, "status", "할 일", "할 일")).toBeNull();
    expect(groupProps("tags", "회의")).toEqual({ tags: ["회의"] });
    expect(groupProps("status", null)).toEqual({});
  });

  it("직접 정한 순서·칸 계산·새 상태 이름", () => {
    expect(reorder(["a", "b", "c"], "c", { beforeId: "a" })).toEqual(["c", "a", "b"]);
    expect(reorder(["a", "b", "c"], "a", { afterId: "c" })).toEqual(["b", "c", "a"]);
    expect(reorder(["a", "b"], "a", {})).toEqual(["b", "a"]);
    const list = [rec("가", { due: "2026-11-01" }), rec("나", { due: "2026-12-01" }), rec("다")];
    expect(groupCalc(list, "count")).toBe("3개");
    expect(groupCalc(list, "due")).toBe("마감 2개");
    expect(groupCalc(list, "late", "2026-11-20")).toBe("지남 1개");
    expect(groupCalc(list, "none")).toBeNull();
    expect(newStatusName([{ name: "새 상태", color: "gray" }])).toBe("새 상태 2");
    expect(nextColor([{ name: "a", color: "orange" }])).toBe("brown");
  });

  it("달력: 일요일 시작 42칸, 이번 달 밖 표시", () => {
    const g = monthGrid(2026, 10); // 2026년 11월 1일은 일요일
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ date: "2026-11-01", day: 1, out: false });
    expect(g[30]).toEqual({ date: "2026-12-01", day: 1, out: true });
    const dec = monthGrid(2026, 11); // 12월 1일은 화요일
    expect(dec[0]).toEqual({ date: "2026-11-29", day: 29, out: true });
  });

  it("마감 표시와 지남", () => {
    expect(formatDue("2026-11-24", "2026-11-20")).toEqual({ text: "11월 24일", late: false });
    expect(formatDue("2026-11-12", "2026-11-20")).toEqual({ text: "11월 12일", late: true });
    expect(formatDue("2027-01-05", "2026-11-20").text).toBe("2027년 1월 5일");
  });

  it("체크리스트 진행률", () => {
    const item = (checked: boolean) => ({ type: "taskItem", attrs: { checked }, content: [] });
    expect(
      checklistProgress({
        type: "doc",
        content: [
          { type: "taskList", content: [item(true), item(false), item(true), item(false)] },
        ],
      }),
    ).toEqual({ done: 2, total: 4 });
    expect(checklistProgress({ type: "doc", content: [] })).toEqual({ done: 0, total: 0 });
  });
});

describe("보기마다 정렬·필터 (COLL-06, 스키마 10)", () => {
  const base = normalizeCollection(null);
  const settings: CollectionSettings = {
    ...base,
    view: "grid",
    viewState: {
      ...base.viewState,
      board: { sort: null, filters: [{ field: "status", value: "검토" }] },
    },
  };

  it("viewQuery는 지금 보기 또는 지정한 보기의 정렬·필터를 준다", () => {
    expect(viewQuery(settings)).toEqual(base.viewState.grid);
    expect(viewQuery(settings, "board").filters).toEqual([{ field: "status", value: "검토" }]);
  });

  it("withViewQuery는 그 보기만 바꾸고 다른 보기는 그대로 둔다", () => {
    const next = {
      ...settings,
      ...withViewQuery(settings, { sort: { field: "due", dir: "asc" } }),
    };
    expect(next.viewState.grid.sort).toEqual({ field: "due", dir: "asc" });
    expect(next.viewState.board).toEqual(settings.viewState.board);
    expect(next.viewState.calendar).toEqual(settings.viewState.calendar);
    expect(withViewQuery(settings, { filters: [] }, "calendar").viewState.calendar.filters).toEqual(
      [],
    );
  });

  it("mapViewQueries는 세 보기 모두에 같은 규칙을 건다", () => {
    const out = mapViewQueries(settings, (q) => ({ ...q, filters: [] }));
    expect(Object.keys(out.viewState).sort()).toEqual(["board", "calendar", "grid"]);
    expect(Object.values(out.viewState).every((q) => q.filters.length === 0)).toBe(true);
  });

  it("deleteField는 모든 보기의 필터·정렬에서 그 속성을 뺀다", () => {
    const id = "fabcd1234" as const;
    const field = { id, name: "금액", type: "number" as const, options: [] };
    const withField: CollectionSettings = {
      ...settings,
      fields: [field],
      viewState: {
        grid: { sort: { field: id, dir: "asc" }, filters: [{ field: id, value: "A" }] },
        board: {
          sort: null,
          filters: [
            { field: id, value: "A" },
            { field: "status", value: "검토" },
          ],
        },
        calendar: { sort: null, filters: [] },
      },
    };
    const out = deleteField(withField, id);
    expect(out.viewState.grid).toEqual({ sort: null, filters: [] });
    expect(out.viewState.board.filters).toEqual([{ field: "status", value: "검토" }]);
  });
});
