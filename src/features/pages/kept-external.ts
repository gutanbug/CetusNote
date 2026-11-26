/**
 * 바깥 변경을 버전 기록에 남긴 저장 알림 (DATA-07).
 * 저장 큐가 쓰기를 마친 뒤 Rust가 「바깥 내용을 남겼다」고 알리면 이 목록의 귀를 부른다. 화면이 토스트를 띄운다.
 */
type KeptListener = (pageId: string) => void;

const listeners = new Set<KeptListener>();

export function notifyKeptExternal(pageId: string): void {
  for (const listener of [...listeners]) listener(pageId);
}

/** 알림을 받는다. 돌려주는 함수로 등록을 푼다 */
export function onKeptExternal(listener: KeptListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
