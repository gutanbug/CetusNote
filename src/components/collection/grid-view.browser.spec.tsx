import "@/styles/globals.css";
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GridView, type GridColumn } from "./grid-view";
import type { RecordItem } from "./fields";

/*
 * 표 행 메모 회귀 (SYS-11). 레코드 한 건만 바뀌고 부모가 콜백·열을 새로 만들어 넘겨도,
 * 바뀐 행의 셀만 다시 그려져야 한다. 셀 함수 호출 수로 센다 (행마다 셀 함수는 한 번씩 불린다).
 */

const N = 10_000;
const items = (): RecordItem[] =>
  Array.from({ length: N }, (_, i) => ({ id: `r${i}`, title: `레코드 ${i}`, tags: [] }));

/** 셀 호출을 센다. 열 객체는 테스트가 한 번만 만든다 — 부모가 매번 새로 만드는 상황은 rerender에서 흉내 낸다 */
function makeColumns(calls: Map<string, number>): GridColumn[] {
  return [
    {
      key: "memo",
      name: "메모",
      kind: "text",
      cell: (item) => {
        calls.set(item.id, (calls.get(item.id) ?? 0) + 1);
        return <span>{item.title}</span>;
      },
    },
  ];
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  container?.remove();
  root = null;
  container = null;
});

/** 부모가 넘기는 콜백·옵션 — 렌더마다 새로 만들지 않는 값이 계약이다 (옵션 배열도 고정) */
const STATUS_OPTIONS: never[] = [];
const CHOICES: string[] = [];
const noop = () => {};
function Harness({ items, columns }: { items: RecordItem[]; columns: GridColumn[] }) {
  return (
    <TooltipProvider>
      <GridView
        items={items}
        columns={columns}
        onOpen={noop}
        onOpenPage={noop}
        onStatusChange={noop}
        statusOptions={STATUS_OPTIONS}
        onAssigneeChange={noop}
        onStartChange={noop}
        onDueChange={noop}
        assigneeChoices={CHOICES}
        onNew={noop}
      />
    </TooltipProvider>
  );
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("GridView 행 메모 (SYS-11)", () => {
  it("레코드 한 건을 고치면 그 행의 셀만 다시 그린다", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const calls = new Map<string, number>();
    const columns = makeColumns(calls);
    const base = items();

    await act(async () => root!.render(<Harness items={base} columns={columns} />));
    expect(calls.size).toBeGreaterThan(0);
    const firstPass = calls.size;

    // 같은 데이터로 다시 그리면 셀은 하나도 다시 불리지 않는다
    calls.clear();
    await act(async () => root!.render(<Harness items={base} columns={columns} />));
    expect(calls.size).toBe(0);
    expect(firstPass).toBeGreaterThan(1);

    // 한 건만 바꾸면 (새 객체) 그 행만 다시 그린다
    const next = base.slice();
    next[2] = { ...base[2]!, title: "고친 레코드" };
    calls.clear();
    await act(async () => root!.render(<Harness items={next} columns={columns} />));
    expect([...calls.keys()]).toEqual(["r2"]);
  });
});
