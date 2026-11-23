import * as React from "react";

/**
 * 스크롤 화면의 아래 여백(SHELL-13 · SHELL-17).
 * 고정 padding은 내용이 화면에 딱 맞을 때도 스크롤을 만든다(특히 110~150% 화면 크기).
 * 그래서 여백을 `tail` 요소(높이 --s16)로 두고, 내용이 스크롤 영역보다 길 때만 펼친다.
 *
 * 사용: scroller(ref) > body(ref) > …내용…, tail(ref, `tailOpen ? "h-16" : "hidden"`)
 */
export function useBottomTail() {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const tailRef = React.useRef<HTMLDivElement>(null);
  const [tailOpen, setTailOpen] = React.useState(false);

  React.useLayoutEffect(() => {
    const sc = scrollRef.current;
    const body = bodyRef.current;
    const tail = tailRef.current;
    if (!sc || !body || !tail || typeof ResizeObserver === "undefined") return;
    const check = () => {
      // 펼쳐진 tail의 높이를 빼고 잰다. 그래야 펼침과 접힘이 서로를 뒤집지 않는다
      const natural = body.offsetHeight - tail.offsetHeight;
      setTailOpen(natural > sc.clientHeight);
    };
    const ro = new ResizeObserver(check);
    ro.observe(sc);
    ro.observe(body);
    check();
    return () => ro.disconnect();
  }, []);

  return { scrollRef, bodyRef, tailRef, tailOpen };
}
