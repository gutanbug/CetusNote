/**
 * 워크스페이스 세대 번호 (DATA-03, SYS-09).
 * 워크스페이스가 실제로 바뀔 때마다 1씩 올린다. 비동기 작업은 시작할 때의 세대를 기억해 두고,
 * 끝난 뒤 세대가 다르면 이전 워크스페이스의 결과이므로 상태에 반영하지 않는다(쓰기도 마찬가지).
 * 다른 feature가 import하므로 의존성이 없는 leaf 모듈로 둔다.
 */
let generation = 0;

export const currentWorkspaceGeneration = (): number => generation;

export function advanceWorkspaceGeneration(): number {
  generation += 1;
  return generation;
}
