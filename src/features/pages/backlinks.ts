import { msg } from "@/lib/i18n";
import type { Page } from "@/lib/storage";

/** 페이지 링크 주소 앞부분 (ED-PageMention의 PAGE_LINK_PREFIX와 같다) */
const LINK_PREFIX = "cetusnote://page/";
/** 문맥 한 줄 최대 글자 수, 멘션 앞에 남길 글자 수 */
const SNIPPET_MAX = 120;
const SNIPPET_BEFORE = 40;
/** 한 페이지에서 한 대상에 대해 보여 줄 문맥 수 */
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

/** 한 페이지가 한 대상을 언급한 것 (SYS-10): 개수와 문맥 */
export type LinkHit = { count: number; snippets: BacklinkSnippet[] };

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
 * 페이지 하나가 언급한 페이지들 (대상 id → 언급). 페이지 링크 표식(`cetusnote://page/<id>`)과 멘션(`pageMention`)을 모두 본다.
 * 멘션 칩 글은 titleOf로 지금 제목을 쓴다. 백링크 찾기와 본문 요약(summary.ts)이 같은 결과를 쓴다.
 */
export function linksOf(
  page: Pick<Page, "content">,
  titleOf: (id: string) => string | undefined = () => undefined,
): Map<string, LinkHit> {
  const out = new Map<string, LinkHit>();

  /** 블록 하나를 글로 펴면서 언급 자리를 대상별로 모은다 */
  const flatten = (block: Node) => {
    let text = "";
    const hits = new Map<string, [number, number][]>();
    const hit = (target: string, range: [number, number]) => {
      const list = hits.get(target);
      if (list) list.push(range);
      else hits.set(target, [range]);
    };
    const walk = (n: Node) => {
      if (n.type === "text") {
        const s = n.text ?? "";
        const targets = new Set<string>();
        for (const m of n.marks ?? []) {
          const href = m.type === "link" ? m.attrs?.href : undefined;
          if (typeof href === "string" && href.startsWith(LINK_PREFIX))
            targets.add(href.slice(LINK_PREFIX.length));
        }
        for (const t of targets) hit(t, [text.length, text.length + s.length]);
        text += s;
      } else if (n.type === "pageMention") {
        const label = `@${titleOf(String(n.attrs?.id)) || String(n.attrs?.label ?? "") || msg().features.untitled}`;
        if (typeof n.attrs?.id === "string")
          hit(n.attrs.id, [text.length, text.length + label.length]);
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
      for (const [target, list] of hits) {
        const entry = out.get(target) ?? { count: 0, snippets: [] };
        entry.count += list.length;
        const first = list[0];
        if (first && entry.snippets.length < SNIPPETS_PER_PAGE)
          entry.snippets.push(cut(text, first));
        out.set(target, entry);
      }
      return;
    }
    // 하위 페이지 블록은 글이 없어도 그 페이지를 가리킨다 (EDIT-29)
    if (n.type === "subpage" && typeof n.attrs?.pageId === "string") {
      const label = titleOf(n.attrs.pageId) || msg().features.export.fallback.subpage;
      const entry = out.get(n.attrs.pageId) ?? { count: 0, snippets: [] };
      entry.count += 1;
      if (entry.snippets.length < SNIPPETS_PER_PAGE)
        entry.snippets.push({ text: label, highlight: [0, label.length] });
      out.set(n.attrs.pageId, entry);
      return;
    }
    n.content?.forEach(visit);
  };
  visit(page.content as Node);
  return out;
}

/** 백링크 대상이 될 수 있는 페이지인지: 휴지통·템플릿·폴더·컬렉션은 빼고, 자기 자신도 뺀다 */
export function isBacklinkSource(page: Page, id: string): boolean {
  return page.id !== id && !page.trashedAt && !page.template && page.kind === "page";
}

/**
 * 백링크 (PAGE-09): 이 페이지를 멘션(`pageMention`)하거나 페이지 링크(`cetusnote://page/<id>`)를 건 페이지.
 * 휴지통·자기 자신은 뺀다. 최근에 고친 페이지가 앞. titleOf로 멘션 칩에 지금 제목을 쓴다.
 */
export function findBacklinks(
  pages: Record<string, Page>,
  id: string,
  titleOf: (id: string) => string | undefined = (x) => pages[x]?.title,
): Backlink[] {
  return backlinksFrom(
    id,
    Object.values(pages)
      .filter((page) => isBacklinkSource(page, id))
      .map((page) => ({ page, links: linksOf(page, titleOf) })),
  );
}

/** 미리 뽑은 언급(links)으로 백링크를 모은다. 최근에 고친 페이지가 앞 */
export function backlinksFrom(
  id: string,
  sources: Iterable<{ page: Page; links: Map<string, LinkHit> }>,
): Backlink[] {
  const out: Backlink[] = [];
  for (const { page, links } of sources) {
    if (!isBacklinkSource(page, id)) continue;
    const hit = links.get(id);
    if (hit && hit.count) out.push({ page, count: hit.count, snippets: hit.snippets });
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
