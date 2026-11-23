/**
 * PDF 쪽 나누기 (DATA-06). 인쇄 전용 화면의 블록들을 A4 한 쪽 높이에 맞춰 묶는다.
 * 쪽은 Rust가 찍는다(pdf.rs, createPDF의 rect). 여기서는 어느 블록이 어느 쪽에 드는지만 정한다.
 * WKWebView createPDF의 좌표 단위는 CSS px이며 PDF에서는 pt와 같다.
 */

/** A4 용지 (pt). 595.28 × 841.89 */
export const A4 = { width: 595.28, height: 841.89 } as const;

/** 쪽 여백 (pt): 위아래 18mm, 좌우 16mm. 쪽 맨 위·아래에서 이만큼 비운다 */
export const PAGE_MARGIN = { top: 51, side: 45 } as const;

/** 쪽 하나에서 블록이 쓸 수 있는 높이 */
export const CONTENT_HEIGHT = A4.height - PAGE_MARGIN.top * 2;

/** 블록 하나의 세로 자리 (문서 좌표, 위 → 아래) */
export type BlockBox = { top: number; bottom: number };

/** 한 쪽에 드는 블록들. start는 쪽 첫 블록의 위, end는 마지막 블록의 아래 */
export type PageSlice = { start: number; end: number; blocks: number[] };

/**
 * 블록 상자들을 쪽에 나눈다. 블록은 쪽 중간에서 잘리지 않는다.
 * 블록 하나가 쪽 높이보다 크면 그 블록만 한 쪽에 둔다(그 쪽 아래는 잘릴 수 있다).
 */
export function planPages(boxes: BlockBox[], contentHeight = CONTENT_HEIGHT): PageSlice[] {
  const pages: PageSlice[] = [];
  let current: PageSlice | null = null;
  boxes.forEach((box, index) => {
    if (!current || box.bottom - current.start > contentHeight) {
      current = { start: box.top, end: box.bottom, blocks: [index] };
      pages.push(current);
      return;
    }
    current.blocks.push(index);
    current.end = Math.max(current.end, box.bottom);
  });
  return pages;
}

/**
 * 인쇄 화면의 블록 요소들. 본문은 편집기(.ProseMirror) 안의 자식들을 블록으로 본다.
 * 편집기를 감싼 요소는 블록이 아니라 그 자식들을 본다.
 */
export function printBlocks(root: HTMLElement): HTMLElement[] {
  const editor = root.querySelector<HTMLElement>(".ProseMirror");
  const out: HTMLElement[] = [];
  const walk = (el: HTMLElement) => {
    if (editor && el === editor) {
      out.push(...Array.from(editor.children, (child) => child as HTMLElement));
    } else if (editor && el.contains(editor)) {
      Array.from(el.children, (child) => child as HTMLElement).forEach(walk);
    } else {
      out.push(el);
    }
  };
  Array.from(root.children, (child) => child as HTMLElement).forEach(walk);
  return out;
}

/** 블록들의 문서 좌표 세로 자리 (스크롤이 0일 때 웹뷰 문서 좌표와 같다) */
export function measureBlocks(blocks: HTMLElement[]): BlockBox[] {
  const scroll = window.scrollY;
  return blocks.map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + scroll, bottom: r.bottom + scroll };
  });
}
