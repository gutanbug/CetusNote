import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type PdfPreviewStatus = "loading" | "ready" | "saving" | "error";

type PdfPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: PdfPreviewStatus;
  /** 만든 PDF의 미리보기 주소 (blob:). ready·saving에서만 그린다 */
  previewUrl: string | null;
  /** status가 error일 때 보여 줄 이유 */
  message?: string | null;
  onSave: () => void;
};

/**
 * PDF 내보내기 미리보기 (DATA-06). 만들어진 PDF를 그대로 보여 주고, "PDF로 저장"으로 저장 위치를 고르게 한다.
 * 닫기·취소는 저장하지 않는다. 화면은 props만 받는다(만들기·저장은 화면이 맡는다).
 */
export function PdfPreview({
  open,
  onOpenChange,
  status,
  previewUrl,
  message,
  onSave,
}: PdfPreviewProps) {
  const showPreview = (status === "ready" || status === "saving") && previewUrl;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="grid gap-4">
        <div className="grid gap-1">
          <DialogTitle>PDF로 내보내기</DialogTitle>
          <DialogDescription className="text-caption text-tertiary">
            미리보기를 확인하고 PDF로 저장해요.
          </DialogDescription>
        </div>

        <div className="relative h-140 min-h-0 overflow-hidden rounded-md border border-line bg-app">
          {showPreview ? (
            <iframe title="PDF 미리보기" src={previewUrl} className="block size-full border-0" />
          ) : (
            <p
              role="status"
              className="grid h-full place-items-center px-6 text-center text-ui text-tertiary"
            >
              {status === "error" ? (message ?? "PDF를 만들지 못했어요.") : "PDF를 만들고 있어요."}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button onClick={onSave} disabled={status !== "ready"}>
            {status === "saving" ? "저장하는 중이에요" : "PDF로 저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
