// L1–L2가 함께 쓰는 상태 스타일 조각. 값은 모두 토큰 유틸리티다.

/** 포커스 링: --accent 2px, 간격 2px. 키보드 포커스에만 보인다. */
export const focusRing =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-accent";

/** 입력 계열 포커스: 테두리 accent + 3px 소프트 링 (프로토타입 .input:focus). */
export const fieldFocus =
  "outline-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent-soft";

/**
 * 누름 영역 넓히기: 보이는 크기는 그대로 두고 투명한 ::before로 사방 4px을 더한다(16px → 24px, WCAG 2.5.8).
 * 요소가 기준 위치(relative·absolute)를 가져야 한다.
 */
export const hitArea = "before:absolute before:-inset-1 before:content-['']";

/** 눌림: scale 0.98 (칩은 0.96). data-press로 움직임 줄이기 설정이 끈다. */
export const press =
  "active:scale-98 force-active:scale-98 transition-[background-color,color,border-color,transform]";

/** 메뉴 항목 (OV-Menu, OV-CommandPalette 결과 행) */
/**
 * 메뉴 항목. 키보드로 옮긴 항목은 배경(hover)에 더해 안쪽 포커스 링(--accent 2px)을 보인다 —
 * 배경만으로는 대비가 모자라다(2026-11-21 감사). 안쪽에 그려 스크롤 메뉴에서도 잘리지 않는다.
 * 팔레트(OV-CommandPalette)는 항목에 포커스를 주지 않으므로(aria-selected) 링이 생기지 않는다.
 */
export const menuItem =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent relative flex min-h-7.5 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-ui text-primary outline-none select-none transition-colors hover:bg-hover force-hover:bg-hover focus:bg-hover data-highlighted:bg-hover data-[selected=true]:bg-hover active:bg-active data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-secondary";

/** 팝오버 면 (OV-Popover, 메뉴, 팔레트) */
export const popoverSurface =
  "z-50 rounded-lg bg-elevated p-1 text-primary shadow-popover data-[state=open]:animate-pop";
