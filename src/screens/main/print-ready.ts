/** 인쇄 전용 화면의 자리 (globals.css의 #print-root와 같다) */
export const PRINT_ROOT_ID = "print-root";
const ROOT_ID = PRINT_ROOT_ID;

/** 인쇄 화면이 그 페이지를 다 그렸을 때(글꼴·이미지 포함, 최대 5초) */
export async function printViewReady(id: string, timeout = 5000): Promise<boolean> {
  const start = performance.now();
  // 창이 가려지면 WebKit이 rAF를 멈춘다 — 타이머와 겨뤄야 timeout이 지켜진다
  const frame = () =>
    new Promise((r) => {
      const t = setTimeout(r, 50);
      requestAnimationFrame(() => {
        clearTimeout(t);
        r(null);
      });
    });
  while (performance.now() - start < timeout) {
    await frame();
    const root = document.getElementById(ROOT_ID);
    if (root?.dataset.page !== id || !root.querySelector(".ProseMirror")) continue;
    const loading = root.querySelector('[data-status="loading"]');
    const imgs = [...root.querySelectorAll("img")].every((i) => i.complete);
    if (!loading && imgs) {
      await document.fonts?.ready;
      await frame();
      return true;
    }
  }
  return false;
}
