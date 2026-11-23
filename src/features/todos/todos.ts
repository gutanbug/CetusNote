import type { JSONContent } from "@tiptap/core";

/**
 * 할 일 모으기 (SHELL-13 홈 "오늘의 할 일") — 모든 문서의 체크리스트 항목(taskItem)을 찾는다.
 * 항목은 문서 안의 위치(path: 자식 번호 목록)로 가리킨다. 저장 형식에 id를 더하지 않는다.
 */
export type TodoRef = {
  /** `${pageId}:${path.join(".")}` */
  key: string;
  pageId: string;
  path: number[];
  text: string;
  checked: boolean;
};

type Node = JSONContent;

/** 항목 자신의 글(첫 문단). 안에 든 하위 항목은 따로 모은다 */
function ownText(item: Node): string {
  const first = item.content?.[0];
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (n.type === "text") parts.push(n.text ?? "");
    else if (n.type === "hardBreak") parts.push(" ");
    else if (n.type === "inlineMath") parts.push(String(n.attrs?.latex ?? ""));
    else if (n.type === "pageMention") parts.push(String(n.attrs?.label ?? ""));
    n.content?.forEach(walk);
  };
  if (first) walk(first);
  return parts.join("").replace(/\s+/g, " ").trim();
}

/** 한 문서의 체크리스트 항목 — 문서 순서대로 */
export function pageTodos(page: { id: string; content: unknown }): TodoRef[] {
  const out: TodoRef[] = [];
  const walk = (n: Node, path: number[]) => {
    if (n.type === "taskItem")
      out.push({
        key: `${page.id}:${path.join(".")}`,
        pageId: page.id,
        path,
        text: ownText(n),
        checked: n.attrs?.checked === true,
      });
    n.content?.forEach((c, i) => walk(c, [...path, i]));
  };
  walk(page.content as Node, []);
  return out;
}

/**
 * 열린(체크하지 않은) 할 일 — 최근에 고친 문서부터, 문서 안에서는 위에서부터.
 * 글이 빈 항목(템플릿이 만든 빈 칸 등)은 뺀다.
 */
export function openTodos(pages: { id: string; content: unknown; updatedAt: string }[]): TodoRef[] {
  return [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .flatMap((p) => pageTodos(p))
    .filter((t) => !t.checked && t.text);
}

/** path의 항목을 체크/해제한 새 문서. 그 자리에 taskItem이 없으면 그대로 돌려준다 */
export function setTodoChecked<T>(doc: T, path: number[], checked: boolean): T {
  const at = (n: Node, rest: number[]): Node => {
    if (!rest.length) return n.type === "taskItem" ? { ...n, attrs: { ...n.attrs, checked } } : n;
    const [i, ...more] = rest;
    const child = n.content?.[i!];
    if (!child) return n;
    const next = at(child, more);
    if (next === child) return n;
    const content = [...n.content!];
    content[i!] = next;
    return { ...n, content };
  };
  return at(doc as Node, path) as T;
}
