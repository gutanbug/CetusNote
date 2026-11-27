/**
 * `@tiptap/extension-collaboration` 대역 (SYS-11). 끌기 손잡이가 `isChangeOrigin`만 쓴다.
 * 협업 플러그인이 없으면 원격 변경도 없으므로 늘 false다. vite.config.ts의 alias가 이 파일로 돌린다.
 */
export function isChangeOrigin(): boolean {
  return false;
}
