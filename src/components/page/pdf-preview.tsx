import { useState } from "react";
import { MoveHorizontal, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { useMessages } from "@/lib/i18n";

export type PdfPreviewStatus = "loading" | "ready" | "saving" | "error";

type PdfPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: PdfPreviewStatus;
  /** 쪽마다 그린 미리보기 그림의 주소 (blob:), 쪽 순서대로. error가 아닐 때 보여 준다 */
  pages: string[];
  /** status가 error일 때 보여 줄 이유 */
  message?: string | null;
  onSave: () => void;
  /** status가 error일 때 다시 만들기 */
  onRetry?: () => void;
};

/** 확대·축소 단계. 100%는 너비에 맞춘 크기다 */
const ZOOM_STEPS = [50, 75, 100, 125, 150, 200];

/**
 * PDF 내보내기 미리보기 (DATA-06). 쪽을 그림으로 보여 주고 확대·축소한다. 저장은 "PDF로 저장"으로 한다.
 * 브라우저 PDF 뷰어를 쓰지 않으므로 그 안내 막대가 뜨지 않는다. 닫기·취소는 저장하지 않는다.
 * 화면은 props만 받는다(만들기·저장은 화면이 맡는다).
 */
export function PdfPreview({
  open,
  onOpenChange,
  status,
  pages,
  message,
  onSave,
  onRetry,
}: PdfPreviewProps) {
  const m = useMessages();
  const [zoom, setZoom] = useState(100);
  const showPages = status !== "error" && pages.length > 0;
  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const canZoomOut = zoomIndex > 0;
  const canZoomIn = zoomIndex < ZOOM_STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="grid h-[calc(var(--fit-h)*0.88)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3"
      >
        <DialogHeader>
          <DialogTitle>{m.page.pdf.title}</DialogTitle>
          <DialogDescription className="text-caption text-tertiary">
            {m.page.pdf.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-8 items-center justify-between gap-2">
          <span className="text-caption text-tertiary tabular-nums">
            {showPages ? m.page.pdf.pageCount(pages.length) : ""}
          </span>
          <div className="flex items-center gap-1">
            <IconButton
              label={m.page.pdf.zoomOut}
              disabled={!showPages || !canZoomOut}
              onClick={() => setZoom(ZOOM_STEPS[zoomIndex - 1] ?? zoom)}
            >
              <ZoomOut strokeWidth={1.5} />
            </IconButton>
            <span
              aria-live="polite"
              className="w-12 text-center text-caption text-secondary tabular-nums"
            >
              {zoom}%
            </span>
            <IconButton
              label={m.page.pdf.zoomIn}
              disabled={!showPages || !canZoomIn}
              onClick={() => setZoom(ZOOM_STEPS[zoomIndex + 1] ?? zoom)}
            >
              <ZoomIn strokeWidth={1.5} />
            </IconButton>
            <IconButton
              label={m.page.pdf.fitWidth}
              disabled={!showPages || zoom === 100}
              onClick={() => setZoom(100)}
            >
              <MoveHorizontal strokeWidth={1.5} />
            </IconButton>
          </div>
        </div>

        <div
          tabIndex={0}
          aria-label={m.page.pdf.previewArea}
          className={cn(
            "relative min-h-0 overflow-auto rounded-md border border-line bg-app",
            focusRing,
          )}
        >
          {showPages ? (
            <ol
              aria-label={m.page.pdf.pageList}
              className="mx-auto grid gap-4 p-4"
              style={{ width: `${zoom}%` }}
            >
              {pages.map((src, index) => (
                <li key={src}>
                  <img
                    src={src}
                    alt={m.page.pdf.pageNo(index + 1)}
                    draggable={false}
                    className="block w-full rounded-xs bg-paper shadow-popover"
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p
              role="status"
              className="grid h-full min-h-40 place-items-center px-6 text-center text-ui text-tertiary"
            >
              {status === "error" ? (message ?? m.page.pdf.errorDefault) : m.page.pdf.building}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {m.page.close}
          </Button>
          {status === "error" && onRetry ? (
            <Button onClick={onRetry}>{m.page.pdf.retry}</Button>
          ) : null}
          <Button onClick={onSave} disabled={status !== "ready"}>
            {status === "saving" ? m.page.pdf.saving : m.page.pdf.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
