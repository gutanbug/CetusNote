// L3 셸이 함께 쓰는 스타일 조각. 값은 모두 토큰 유틸리티다.

/** 사이드바 안쪽 포커스 링 — 사이드바가 overflow-hidden이라 링을 안쪽으로 그린다. */
export const insetFocus =
  "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent";

/** 사이드바 행 (프로토타입 .nav-item · .tree-row) */
export const rowBase =
  "flex w-full cursor-default items-center rounded-md text-left text-ui text-secondary select-none transition-colors duration-(--dur-fast) hover:bg-hover hover:text-primary force-hover:bg-hover force-hover:text-primary";

/** 선택된 행 — 포인트 색 소프트 배경 + 포인트 색 글자 */
export const rowActive =
  "data-[active=true]:bg-sel data-[active=true]:font-medium data-[active=true]:text-sel-fg";

/** 행에 마우스를 올리거나 키보드로 오면 드러나는 보조 요소 */
export const revealOnRow =
  "opacity-0 transition-opacity duration-(--dur-fast) group-hover/row:opacity-100 group-focus-visible/row:opacity-100 force-hover:opacity-100";
