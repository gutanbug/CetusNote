/** 첫 화면을 그리는 일과 겹치지 않게 조금 뒤에 백업한다 (DATA-05) */
export const AUTO_BACKUP_DELAY_MS = 3000;

/**
 * 자동 백업을 예약한다. 기다리는 사이 워크스페이스가 바뀌었으면 백업하지 않는다 (DATA-05).
 * 백업이 실패(false)하면 onFailed를 한 번 부른다. 취소 함수를 돌려준다.
 */
export function scheduleAutoBackup({
  delay = AUTO_BACKUP_DELAY_MS,
  isCurrent,
  backup,
  onFailed,
}: {
  delay?: number;
  /** 예약 시점과 같은 워크스페이스인지 */
  isCurrent: () => boolean;
  backup: () => Promise<unknown>;
  onFailed: () => void;
}): () => void {
  const timer = setTimeout(() => {
    if (!isCurrent()) return;
    void backup().then((r) => {
      if (r === false) onFailed();
    });
  }, delay);
  return () => clearTimeout(timer);
}
