/**
 * 페이지 화면을 떠날 때 찾기·목차를 닫는 일을 한 박자 미룬다.
 * 바깥 변경(DATA-07)으로 같은 페이지의 화면이 key만 바뀌어 다시 만들어지면, 정리(떠남)와 새 화면(들어옴)이
 * 같은 커밋에서 일어난다. 그때는 들어옴이 먼저 닫기를 취소해, 열어 둔 찾기 막대와 목차가 닫히지 않게 한다.
 */
const pending = new Map<string, ReturnType<typeof setTimeout>>();

/** 페이지 화면이 사라졌다. 바로 다음 턴에 `close`를 부른다 (같은 페이지가 들어오면 취소된다) */
export function leavePage(pageId: string, close: () => void): void {
  clearTimeout(pending.get(pageId));
  pending.set(
    pageId,
    setTimeout(() => {
      pending.delete(pageId);
      close();
    }, 0),
  );
}

/** 페이지 화면이 붙었다. 같은 페이지의 대기 중인 닫기를 취소한다 */
export function enterPage(pageId: string): void {
  const timer = pending.get(pageId);
  if (timer === undefined) return;
  clearTimeout(timer);
  pending.delete(pageId);
}
