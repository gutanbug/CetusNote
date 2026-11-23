import type { Page } from "@/lib/storage";

/** 페이지 링크 주소 앞부분 (ED-PageMention의 PAGE_LINK_PREFIX와 같다) */
const LINK_PREFIX = "cetusnote://page/";
/** 문맥 한 줄 최대 글자 수, 멘션 앞에 남길 글자 수 */
const SNIPPET_MAX = 120;
const SNIPPET_BEFORE = 40;
/** 한 페이지에서 보여 줄 문맥 수 */
const SNIPPETS_PER_PAGE = 3;

type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
};

export type BacklinkSnippet = {
  /** 언급이 들어 있는 블록의 글(앞뒤를 자르면 …) */
  text: string;
  /** text 안에서 언급 자리 [시작, 끝) */
  highlight: [number, number];
};

export type Backlink = {
  page: Page;
  /** 이 페이지 안의 언급 수 */
  count: number;
  snippets: BacklinkSnippet[];
};

/** 글을 담는 블록 — 언급 문맥은 이 단위로 자른다 */
const TEXT_BLOCKS = new Set([
  "paragraph",
  "heading",
  "taskItem",
  "listItem",
  "tableCell",
  "tableHeader",
  "detailsSummary",
  "image",
  "codeBlock",
]);

/**
 * 백링크 (PAGE-09): 이 페이지를 멘션(`pageMention`)하거나 페이지 링크(`cetusnote://page/<id>`)를 건 페이지.
 * 휴지통·자기 자신은 뺀다. 최근에 고친 페이지가 앞. titleOf로 멘션 칩에 지금 제목을 쓴다.
 */
export function findBacklinks(
  pages: Record<string, Page>,
  id: string,
  titleOf: (id: string) => string | undefined = (x) => pages[x]?.title,
): Backlink[] {
  const out: Backlink[] = [];
  for (const page of Object.values(pages)) {
    if (page.id === id || page.trashedAt || page.template || page.kind !== "page") continue;
    let count = 0;
    const snippets: BacklinkSnippet[] = [];

    /** 블록 하나를 글로 펴면서 언급 자리를 모은다 */
    const flatten = (block: Node) => {
      let text = "";
      const hits: [number, number][] = [];
      const walk = (n: Node) => {
        if (n.type === "text") {
          const s = n.text ?? "";
          const linked = n.marks?.some(
            (m) => m.type === "link" && m.attrs?.href === LINK_PREFIX + id,
          );
          if (linked) hits.push([text.length, text.length + s.length]);
          text += s;
        } else if (n.type === "pageMention") {
          const label = `@${titleOf(String(n.attrs?.id)) || String(n.attrs?.label ?? "") || "제목 없음"}`;
          if (n.attrs?.id === id) hits.push([text.length, text.length + label.length]);
          text += label;
        } else if (n.type === "hardBreak") text += " ";
        else if (n.type === "inlineMath") text += String(n.attrs?.latex ?? "");
        else n.content?.forEach(walk);
      };
      block.content?.forEach(walk);
      return { text, hits };
    };

    const visit = (n: Node) => {
      // 목록 항목은 안쪽 문단이 맡는다(중복 방지)
      if (n.type && TEXT_BLOCKS.has(n.type) && n.type !== "listItem" && n.type !== "taskItem") {
        const { text, hits } = flatten(n);
        count += hits.length;
        const first = hits[0];
        if (first && snippets.length < SNIPPETS_PER_PAGE) snippets.push(cut(text, first));
        return;
      }
      n.content?.forEach(visit);
    };
    visit(page.content as Node);
    if (count) out.push({ page, count, snippets });
  }
  return out.sort((a, b) => b.page.updatedAt.localeCompare(a.page.updatedAt));
}

/** 긴 블록은 언급 앞뒤만 남긴다 */
function cut(text: string, [s, e]: [number, number]): BacklinkSnippet {
  if (text.length <= SNIPPET_MAX) return { text, highlight: [s, e] };
  const from = Math.max(0, s - SNIPPET_BEFORE);
  const to = Math.min(text.length, Math.max(e, from + SNIPPET_MAX));
  const prefix = from > 0 ? "…" : "";
  const suffix = to < text.length ? "…" : "";
  return {
    text: prefix + text.slice(from, to) + suffix,
    highlight: [s - from + prefix.length, e - from + prefix.length],
  };
}
