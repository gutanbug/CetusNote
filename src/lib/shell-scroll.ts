/**
 * 창에 고정된 셸(SYS-05)의 스크롤 가드.
 *
 * CSS `overflow: hidden`은 사용자 스크롤만 막는다. `scrollIntoView`·포커스 이동 같은 프로그램 스크롤은
 * 여전히 문서와 셸을 밀어 내므로(사이드바·상단 바가 통째로 움직인다), 문서·루트·`data-shell` 요소에 생긴
 * 스크롤 위치는 0으로 되돌린다. 실제 스크롤은 안쪽 스크롤러(page-scroller, 사이드바 트리 …)가 맡는다.
 */

const SHELL_SELECTOR = "[data-shell]";

function reset(el: Element | null | undefined) {
  if (!el) return;
  if (el.scrollTop !== 0) el.scrollTop = 0;
  if (el.scrollLeft !== 0) el.scrollLeft = 0;
}

/** 스크롤 가드를 켠다. 돌려받은 함수로 끈다 (테스트·Debug 화면에서 쓴다). */
export function pinShellScroll(doc: Document = document): () => void {
  const onScroll = (e: Event) => {
    const target = e.target;
    if (target === doc) {
      reset(doc.documentElement);
      reset(doc.body);
      return;
    }
    if (!(target instanceof Element)) return;
    const pinned =
      target === doc.documentElement ||
      target === doc.body ||
      target === doc.getElementById("root") ||
      target.matches(SHELL_SELECTOR);
    if (pinned) reset(target);
  };
  // scroll 이벤트는 버블링하지 않으므로 캡처 단계에서 받는다
  doc.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => doc.removeEventListener("scroll", onScroll, { capture: true });
}
