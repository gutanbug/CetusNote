import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Download, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import * as React from "react";
import { FileAttachment, type AttachmentActions } from "./file-attachment";

// pdf.js는 PDF 블록이 마운트될 때만 불러온다 (번들 분할). 워커도 앱 번들의 파일이다(CSP 'self').
type PdfJs = typeof import("pdfjs-dist");
let pdfJsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  pdfJsPromise ??= Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfJsPromise;
}

/** 확대·축소 단계 (기본 100%) */
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_ZOOM = 2;

export type PdfViewerProps = AttachmentActions & {
  name: string;
  /** 워크스페이스 경로(`assets/…`) 또는 이미 웹뷰 주소 */
  src: string;
  /** 경로 → 웹뷰가 읽을 주소 (phase 2: convertFileSrc). 없으면 src를 그대로 쓴다 */
  resolveSrc?: (path: string) => string;
  size?: number;
  /** 원본이 없음 → 바로 파일 카드로 대체 */
  missing?: boolean;
  selected?: boolean;
  editable?: boolean;
  className?: string;
};

/** 불러온 결과. url을 같이 적어 두어 주소가 바뀌면 옛 결과는 무시한다 */
type Load =
  | { url: string; status: "error" }
  | {
      url: string;
      status: "ready";
      doc: PDFDocumentProxy;
      pageCount: number;
      width: number;
      height: number;
    };

/** 쪽 하나. 화면 근처에 올 때만 그린다 (IntersectionObserver) */
function PdfPage({
  doc,
  pageNumber,
  cssWidth,
  cssHeight,
  scale,
  root,
  register,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  cssWidth: number;
  cssHeight: number;
  scale: number;
  root: React.RefObject<HTMLDivElement | null>;
  register: (el: HTMLDivElement | null) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { root: root.current, rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root, visible]);

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    (async () => {
      const page = await doc.getPage(pageNumber);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (cancelled || !canvas || !ctx) return;
      // 고밀도 화면에서도 선명하게 — 픽셀 크기만 키우고 CSS 크기는 그대로 둔다
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvasContext: ctx, canvas, viewport });
      await task.promise;
      page.cleanup();
    })().catch(() => {
      // 취소(확대·축소로 다시 그림)는 무시한다
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, doc, pageNumber, scale]);

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        register(el);
      }}
      data-page={pageNumber}
      style={{ width: cssWidth, height: cssHeight }}
      className="relative shrink-0 overflow-hidden rounded-sm border border-line bg-paper"
    >
      {visible && (
        <canvas
          ref={canvasRef}
          aria-label={`${pageNumber}쪽`}
          role="img"
          style={{ width: cssWidth, height: cssHeight }}
          className="block"
        />
      )}
    </div>
  );
}

/**
 * ED-PdfViewer — PDF 블록. 번들한 pdf.js로 쪽을 세로로 그린다(보이는 쪽만). 확대·축소·쪽 번호는 위 도구 줄.
 * 불러오기에 실패하거나 원본이 없으면 파일 카드(ED-FileAttachment)로 대체한다.
 */
export function PdfViewer({
  name,
  src,
  resolveSrc,
  size,
  missing = false,
  selected = false,
  editable = true,
  className,
  ...actions
}: PdfViewerProps) {
  const url = resolveSrc ? resolveSrc(src) : src;
  const [loaded, setLoaded] = React.useState<Load | null>(null);
  const load: Load | { status: "loading" } = loaded?.url === url ? loaded : { status: "loading" };
  const [zoomIndex, setZoomIndex] = React.useState(DEFAULT_ZOOM);
  const [regionWidth, setRegionWidth] = React.useState(0);
  const [current, setCurrent] = React.useState(1);
  const regionRef = React.useRef<HTMLDivElement>(null);
  const pageEls = React.useRef<(HTMLDivElement | null)[]>([]);
  const zoom = ZOOMS[zoomIndex];

  // 열 때 한 번만 문서를 연다. 쪽은 그릴 때 가져온다
  React.useEffect(() => {
    if (missing) return;
    let alive = true;
    let task: PDFDocumentLoadingTask | undefined;
    loadPdfJs()
      .then(async (pdfjs) => {
        task = pdfjs.getDocument({ url });
        const doc = await task.promise;
        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        // 취소됐으면 cleanup이 task를 부수었으므로 상태를 건드리지 않는다
        if (!alive) return;
        setLoaded({
          url,
          status: "ready",
          doc,
          pageCount: doc.numPages,
          width: vp.width,
          height: vp.height,
        });
      })
      .catch(() => {
        if (alive) setLoaded({ url, status: "error" });
      });
    return () => {
      alive = false;
      void task?.destroy();
    };
  }, [url, missing]);

  // 본문 폭이 바뀌면 "폭 맞춤" 기준을 다시 잡는다
  React.useEffect(() => {
    const el = regionRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setRegionWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [load.status]);

  if (missing || load.status === "error") {
    return (
      <FileAttachment
        name={name}
        size={size}
        kind="pdf"
        missing={missing}
        selected={selected}
        editable={editable}
        notice={missing ? undefined : "미리 보기를 열 수 없어요"}
        className={className}
        {...actions}
      />
    );
  }

  const ready = load.status === "ready" ? load : null;
  const base = ready && regionWidth > 0 ? regionWidth / ready.width : 1;
  const cssWidth = ready ? ready.width * base * zoom : 0;
  const cssHeight = ready ? ready.height * base * zoom : 0;

  const onScroll = () => {
    const region = regionRef.current;
    if (!region || !ready) return;
    const top = region.getBoundingClientRect().top + region.clientHeight * 0.3;
    // 기준선(본문 위에서 30%)을 처음 넘는 쪽이 지금 쪽이다
    const index = pageEls.current.findIndex((el) => el && el.getBoundingClientRect().bottom > top);
    setCurrent(index < 0 ? ready.pageCount : index + 1);
  };

  const setZoom = (next: number) => setZoomIndex(Math.min(ZOOMS.length - 1, Math.max(0, next)));
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key !== "=" && e.key !== "+" && e.key !== "-" && e.key !== "0") return;
    e.preventDefault();
    if (e.key === "0") setZoomIndex(DEFAULT_ZOOM);
    else setZoom(zoomIndex + (e.key === "-" ? -1 : 1));
  };

  return (
    <figure
      data-slot="pdf-viewer"
      data-state={ready ? "ready" : "loading"}
      data-selected={selected || undefined}
      className={cn(
        "m-0 overflow-hidden rounded-lg border bg-elevated",
        selected ? "border-accent" : "border-line",
        className,
      )}
    >
      {ready ? (
        <div
          role="toolbar"
          aria-label="PDF 도구"
          className="flex items-center gap-1 border-b border-line px-2 py-1"
        >
          <span className="px-1 text-caption text-secondary tabular-nums">
            {current} / {ready.pageCount} 쪽
          </span>
          <span className="flex-1" />
          <IconButton
            label="축소"
            disabled={zoomIndex === 0}
            onClick={() => setZoom(zoomIndex - 1)}
          >
            <ZoomOut strokeWidth={1.5} />
          </IconButton>
          <span className="min-w-12 text-center text-caption text-secondary tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton
            label="확대"
            disabled={zoomIndex === ZOOMS.length - 1}
            onClick={() => setZoom(zoomIndex + 1)}
          >
            <ZoomIn strokeWidth={1.5} />
          </IconButton>
          {(actions.onOpen || actions.onDownload) && (
            <span aria-hidden className="mx-1 h-4 w-px bg-line" />
          )}
          {actions.onOpen && (
            <IconButton label="외부 앱에서 열기" onClick={actions.onOpen}>
              <ExternalLink strokeWidth={1.5} />
            </IconButton>
          )}
          {actions.onDownload && (
            <IconButton label="다른 이름으로 저장" onClick={actions.onDownload}>
              <Download strokeWidth={1.5} />
            </IconButton>
          )}
        </div>
      ) : null}
      <div
        ref={regionRef}
        role="group"
        aria-label={`${name} 미리 보기`}
        aria-busy={!ready}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className={cn(
          "max-h-[70vh] min-h-48 overflow-auto bg-subtle p-4 outline-none",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid",
        )}
      >
        {ready ? (
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: ready.pageCount }, (_, i) => (
              <PdfPage
                key={i}
                doc={ready.doc}
                pageNumber={i + 1}
                cssWidth={cssWidth}
                cssHeight={cssHeight}
                scale={base * zoom}
                root={regionRef}
                register={(el) => {
                  pageEls.current[i] = el;
                }}
              />
            ))}
          </div>
        ) : (
          <p role="status" className="py-16 text-center text-caption text-tertiary">
            PDF 불러오는 중…
          </p>
        )}
      </div>
    </figure>
  );
}
