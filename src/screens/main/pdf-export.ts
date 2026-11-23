import type { PdfPreviewStatus } from "@/components/page/pdf-preview";
import { toast } from "@/components/ui/toast";
import { markdownFileName } from "@/features/export";
import { pagesStore } from "@/features/pages";
import { getStorage } from "@/lib/storage/default";
import { create } from "zustand";
import { printViewReady } from "./print-ready";
import { useMainUi } from "./ui-store";

/** PDF 내보내기 미리보기 대화상자의 상태 (DATA-06). 저장하지 않는다 */
type PdfExportState = {
  open: boolean;
  status: PdfPreviewStatus;
  /** 만든 PDF의 blob 주소 — 닫을 때 해제한다 */
  url: string | null;
  message: string | null;
  /** 저장 대화상자의 기본 이름 (페이지 제목.pdf) */
  fileName: string;
};

export const usePdfExport = create<PdfExportState>(() => ({
  open: false,
  status: "loading",
  url: null,
  message: null,
  fileName: "제목 없음.pdf",
}));

/** 내보내기 한 번을 구분한다. 닫힌 뒤 늦게 끝난 작업의 결과는 버린다 */
let seq = 0;

function dropUrl() {
  const { url } = usePdfExport.getState();
  if (url) URL.revokeObjectURL(url);
}

function errorText(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * 페이지를 PDF로 내보낸다 (DATA-06): 인쇄 전용 화면을 그린 뒤 PDF를 만들어 미리보기로 연다.
 * 저장은 savePdfExport가 맡는다. 시스템 인쇄 창은 띄우지 않는다.
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
    const bytes = await getStorage().renderPdf();
    if (ticket !== seq) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    usePdfExport.setState({ status: "ready", url });
  } catch (e) {
    fail(errorText(e, "PDF를 만들지 못했어요."));
  }
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

export function closePdfExport() {
  seq++;
  dropUrl();
  usePdfExport.setState({ open: false, url: null, status: "loading", message: null });
}
