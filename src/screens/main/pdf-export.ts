import type { PdfPreviewStatus } from "@/components/page/pdf-preview";
import { toast } from "@/components/ui/toast";
import { markdownFileName } from "@/features/export";
import { pagesStore } from "@/features/pages";
import { getStorage } from "@/lib/storage/default";
import { create } from "zustand";
import { PRINT_ROOT_ID, printViewReady } from "./print-ready";
import { A4, PAGE_MARGIN, measureBlocks, planPages, printBlocks } from "./pdf-layout";
import { useMainUi } from "./ui-store";

/** PDF 내보내기 미리보기 대화상자의 상태 (DATA-06). 저장하지 않는다 */
type PdfExportState = {
  open: boolean;
  status: PdfPreviewStatus;
  /** 내보내는 페이지 (다시 시도할 때 쓴다) */
  pageId: string | null;
  /** 만든 PDF의 blob 주소 — 닫을 때 해제한다 */
  url: string | null;
  message: string | null;
  /** 저장 대화상자의 기본 이름 (페이지 제목.pdf) */
  fileName: string;
};

export const usePdfExport = create<PdfExportState>(() => ({
  open: false,
  status: "loading",
  pageId: null,
  url: null,
  message: null,
  fileName: "제목 없음.pdf",
}));

/** 내보내기 한 번을 구분한다(run 번호로도 쓴다). 닫힌 뒤 늦게 끝난 작업의 결과는 버린다 */
let seq = 0;

/** 지금 쪽을 찍고 있는 화면 전환. 끝나거나 닫히면 원래대로 되돌린다 */
let activeCapture: { ticket: number; restore: () => void } | null = null;

/** 내보내기 한 번의 제한 시간. 넘기면 실패로 돌려준다 */
const EXPORT_DEADLINE_MS = 30_000;

function dropUrl() {
  const { url } = usePdfExport.getState();
  if (url) URL.revokeObjectURL(url);
}

function errorText(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

const TIMEOUT_TEXT = "PDF를 제때 만들지 못했어요. 다시 시도해 주세요.";

/** 다음 화면 갱신까지 기다린다. 창이 가려져 rAF가 멈춰도 timeout으로 넘어간다 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, 50);
    requestAnimationFrame(() => {
      clearTimeout(t);
      resolve();
    });
  });
}

/** 제한 시간 안에 끝나지 않으면 실패로 돌린다 */
function within<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(TIMEOUT_TEXT)), Math.max(1, ms));
    work.then(
      (value) => {
        clearTimeout(t);
        resolve(value);
      },
      (error) => {
        clearTimeout(t);
        reject(error);
      },
    );
  });
}

/**
 * 인쇄 화면을 라이트 토큰·A4 폭으로 맞추고 화면에 그 쪽만 보이게 한다. 되돌리는 함수를 돌려준다.
 * 시스템 인쇄 창을 쓰지 않는다. 쪽은 웹뷰를 한 쪽 영역씩 찍어 만든다(pdf.rs).
 */
function beginCapture(root: HTMLElement): () => void {
  activeCapture?.restore();
  const html = document.documentElement;
  const prevTheme = html.dataset.theme;
  html.dataset.pdfCapture = "";
  html.dataset.theme = "light";
  root.style.width = `${A4.width}px`;
  root.style.padding = `${PAGE_MARGIN.top}px ${PAGE_MARGIN.side}px`;
  root.style.boxSizing = "border-box";
  return () => {
    delete html.dataset.pdfCapture;
    if (prevTheme === undefined) delete html.dataset.theme;
    else html.dataset.theme = prevTheme;
    root.removeAttribute("style");
    // 쪽마다 숨긴 블록을 되돌린다. 레이아웃은 숨김만 써서 자리는 그대로다
    for (const el of printBlocks(root)) el.style.visibility = "";
  };
}

/** 찍는 동안 쪽 나누기를 하고 쪽마다 PDF 조각을 만든 뒤 한 파일로 합친다 */
async function capturePages(ticket: number, deadline: number): Promise<ArrayBuffer> {
  const root = document.getElementById(PRINT_ROOT_ID);
  if (!root) throw new Error("인쇄할 화면을 준비하지 못했어요. 다시 시도해 주세요.");
  const storage = getStorage();
  const restore = beginCapture(root);
  activeCapture = { ticket, restore };
  const remaining = () => deadline - performance.now();
  try {
    // 폭을 바꾼 뒤 자리를 다시 잰다
    await nextFrame();
    await nextFrame();
    await document.fonts?.ready;
    await nextFrame();
    if (remaining() <= 0) throw new Error(TIMEOUT_TEXT);

    const blocks = printBlocks(root);
    const pages = planPages(measureBlocks(blocks));
    if (pages.length === 0) throw new Error("찍을 내용이 없어요.");

    for (let index = 0; index < pages.length; index++) {
      if (ticket !== seq) throw new Error("PDF 만들기를 멈췄어요.");
      const page = pages[index];
      const shownSet = new Set(page.blocks);
      blocks.forEach((el, i) => {
        el.style.visibility = shownSet.has(i) ? "" : "hidden";
      });
      await nextFrame();
      const rect = {
        x: 0,
        y: page.start - PAGE_MARGIN.top,
        width: A4.width,
        height: A4.height,
      };
      await within(storage.renderPdfPage(ticket, index, rect), remaining());
    }
    if (ticket !== seq) throw new Error("PDF 만들기를 멈췄어요.");
    return await within(storage.finishPdf(ticket, pages.length), remaining());
  } finally {
    if (activeCapture?.ticket === ticket) {
      activeCapture.restore();
      activeCapture = null;
    }
  }
}

/**
 * 페이지를 PDF로 내보낸다 (DATA-06): 인쇄 전용 화면을 그린 뒤 쪽마다 찍어 PDF를 만들고 미리보기로 연다.
 * 저장은 savePdfExport가 맡는다. 시스템 인쇄 창은 띄우지 않는다. 전체 제한 시간은 30초.
 */
export async function runPdfExport(id: string) {
  const page = pagesStore.getState().pages[id];
  if (!page || page.kind !== "page") return;
  const ticket = ++seq;
  dropUrl();
  useMainUi.getState().setPrintId(id);
  usePdfExport.setState({
    open: true,
    status: "loading",
    pageId: id,
    url: null,
    message: null,
    fileName: markdownFileName(page).replace(/\.md$/, ".pdf"),
  });
  const fail = (message: string) => {
    if (ticket !== seq) return;
    usePdfExport.setState({ status: "error", message });
  };
  if (!(await printViewReady(id))) {
    return fail("인쇄할 화면을 준비하지 못했어요. 다시 시도해 주세요.");
  }
  try {
    const bytes = await capturePages(ticket, performance.now() + EXPORT_DEADLINE_MS);
    if (ticket !== seq) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    usePdfExport.setState({ status: "ready", url });
  } catch (e) {
    fail(errorText(e, "PDF를 만들지 못했어요."));
  }
}

/** 오류 대화상자의 "다시 시도": 같은 페이지로 처음부터 다시 만든다 */
export function retryPdfExport() {
  const { pageId } = usePdfExport.getState();
  if (pageId) void runPdfExport(pageId);
}

/** 미리보기 PDF를 저장 대화상자에서 고른 곳에 쓴다. 저장하면 대화상자를 닫는다 */
export async function savePdfExport() {
  const { status, fileName } = usePdfExport.getState();
  if (status !== "ready") return;
  usePdfExport.setState({ status: "saving" });
  try {
    const saved = await getStorage().savePdf(fileName);
    if (saved) {
      toast(`“${saved}” 파일로 저장했어요.`);
      closePdfExport();
    } else {
      usePdfExport.setState({ status: "ready" });
    }
  } catch (e) {
    toast.error(errorText(e, "PDF를 저장하지 못했어요. 다른 위치를 골라 보세요."));
    usePdfExport.setState({ status: "ready" });
  }
}

/** 닫으면 찍는 중이라도 바로 화면을 되돌린다. 남은 작업의 결과는 버린다 */
export function closePdfExport() {
  seq++;
  activeCapture?.restore();
  activeCapture = null;
  dropUrl();
  usePdfExport.setState({ open: false, url: null, status: "loading", message: null });
}
