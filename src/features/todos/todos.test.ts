import { describe, expect, it } from "vitest";
import { openTodos, pageTodos, setTodoChecked } from "./todos";

const p = (text: string) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const task = (text: string, checked = false, ...sub: object[]) => ({
  type: "taskItem",
  attrs: { checked },
  content: [p(text), ...(sub.length ? [{ type: "taskList", content: sub }] : [])],
});
const page = (id: string, updatedAt: string, ...items: object[]) => ({
  id,
  updatedAt,
  content: { type: "doc", content: [p("머리"), { type: "taskList", content: items }] },
});

describe("할 일 모으기 (SHELL-13)", () => {
  it("문서 순서대로, 하위 항목도 따로 찾는다", () => {
    const todos = pageTodos(
      page("a", "1", task("자료 조사", false, task("논문 두 편")), task("발표", true)),
    );
    expect(todos.map((t) => [t.text, t.checked, t.path.join(".")])).toEqual([
      ["자료 조사", false, "1.0"],
      ["논문 두 편", false, "1.0.1.0"],
      ["발표", true, "1.1"],
    ]);
  });

  it("열린 할 일: 최근에 고친 문서부터, 체크한 것·빈 칸은 뺀다", () => {
    const open = openTodos([
      page("old", "2026-11-01", task("오래된 일")),
      page("new", "2026-11-19", task(""), task("끝난 일", true), task("새 일")),
    ]);
    expect(open.map((t) => t.text)).toEqual(["새 일", "오래된 일"]);
  });

  it("path로 체크하면 그 항목만 바뀌고 나머지는 같은 객체를 쓴다", () => {
    const pg = page("a", "1", task("하나"), task("둘"));
    const [, second] = pageTodos(pg);
    const next = setTodoChecked(pg.content, second!.path, true);
    expect(pageTodos({ id: "a", content: next }).map((t) => t.checked)).toEqual([false, true]);
    expect(next.content![0]).toBe(pg.content.content[0]);
    expect(setTodoChecked(pg.content, [0], true)).toBe(pg.content); // 문단 → 그대로
  });
});
