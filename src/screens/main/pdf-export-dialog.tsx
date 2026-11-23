import { PdfPreview } from "@/components/page/pdf-preview";
import { closePdfExport, retryPdfExport, savePdfExport, usePdfExport } from "./pdf-export";

/** PDF 내보내기 미리보기 (DATA-06) — ⌘K·페이지 메뉴의 "PDF로 내보내기"로 연다. 화면은 components/page/pdf-preview가 그린다 */
export function PdfExportDialog() {
  const s = usePdfExport();
  return (
    <PdfPreview
      open={s.open}
      onOpenChange={(open) => {
        if (!open) closePdfExport();
      }}
      status={s.status}
      previewUrl={s.url}
      message={s.message}
      onSave={() => void savePdfExport()}
      onRetry={retryPdfExport}
    />
  );
}
