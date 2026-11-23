import { ImagePlus, LayoutTemplate, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/ui/icon-picker";
import { PageIcon } from "@/components/ui/page-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import * as React from "react";

type IconUpload = {
  /** 파일 고르기 대화상자. 취소하면 null */
  browse: () => Promise<string | null>;
  file: (file: File) => Promise<string>;
  link: (url: string) => Promise<string>;
};

type PageHeaderProps = {
  title: string;
  /** 제목이 비었을 때 흐리게 보이는 이름 (기본 "제목 없음", 컬렉션은 "이름 없는 컬렉션") */
  placeholder?: string;
  /** 제목을 바꿀 때마다 (글자를 칠 때마다) */
  onTitleChange: (title: string) => void;
  /** 제목에서 Enter · ↓ — 본문으로 넘어간다 */
  onTitleExit?: () => void;
  /** 페이지 아이콘 (이모지 · `lucide:…` · `image:…`, PAGE-10). 없으면 "아이콘 추가"만 보인다 */
  icon?: string;
  onIconChange: (icon: string | undefined) => void;
  /** 최근에 고른 아이콘 값(최신순) */
  recentIcons?: string[];
  /** 업로드 탭 — 각각 새 아이콘 값을 돌려준다. 실패하면 Error(message가 안내 문구) */
  iconUpload?: IconUpload;
  /** 커버 이미지 (PAGE-03). 주소는 부르는 쪽이 만든다. src가 없으면 불러오는 중(또는 못 읽음) — 같은 자리에 옅은 바탕 */
  cover?: { src?: string };
  onAddCover?: () => void;
  onChangeCover?: () => void;
  onRemoveCover?: () => void;
  onOpenTemplates?: () => void;
  /** 전체 폭 (본문 폭 설정) */
  wide?: boolean;
  /** 제목 줄 오른쪽 여백에 두는 장식(고래자리). 커버 아래 제목 줄 기준이라 커버와 겹치지 않는다 */
  aside?: React.ReactNode;
  /** 제목 아래 — PG-Properties */
  children?: React.ReactNode;
  className?: string;
};

/**
 * PG-PageHeader — 커버 · 아이콘(이모지·lucide·이미지) · 제목 · 아이콘/커버/템플릿 버튼 (프로토타입 `.doc-head`).
 * 버튼 줄은 머리에 마우스를 올리거나 키보드로 오면 보인다. 제목은 한 줄 글(plaintext)만 받는다.
 */
function PageHeader({
  title,
  placeholder = "제목 없음",
  onTitleChange,
  onTitleExit,
  icon,
  onIconChange,
  recentIcons,
  iconUpload,
  cover,
  onAddCover,
  onChangeCover,
  onRemoveCover,
  onOpenTemplates,
  wide,
  aside,
  children,
  className,
}: PageHeaderProps) {
  const titleRef = React.useRef<HTMLSpanElement>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerFrom, setPickerFrom] = React.useState<"icon" | "action">("icon");

  // 제목은 비제어로 둔다. 밖에서 값이 바뀌었고 편집 중이 아닐 때만 맞춘다(캐럿이 튀지 않게).
  React.useLayoutEffect(() => {
    const el = titleRef.current;
    if (el && document.activeElement !== el && el.textContent !== title) el.textContent = title;
  }, [title]);

  const [upload, setUpload] = React.useState<{ busy: boolean; error?: string }>({ busy: false });
  const choose = (next: string) => {
    onIconChange(next);
    setPickerOpen(false);
  };
  // 팝오버를 닫으면 그때 돌던 업로드 결과는 버린다(닫은 뒤에 아이콘이 몰래 바뀌지 않게)
  const job = React.useRef(0);
  const run = (task: () => Promise<string | null>) => {
    const id = ++job.current;
    setUpload({ busy: true });
    task().then(
      (next) => {
        if (id !== job.current) return;
        setUpload({ busy: false });
        if (next) choose(next);
      },
      (e: unknown) => {
        if (id !== job.current) return;
        setUpload({
          busy: false,
          error: e instanceof Error ? e.message : "이미지를 올리지 못했어요. 다시 시도해 주세요.",
        });
      },
    );
  };

  const picker = (
    <PopoverContent
      aria-label="아이콘 고르기"
      className="w-auto max-w-none p-0"
      align="start"
      onCloseAutoFocus={() => {
        job.current++;
        setUpload({ busy: false });
      }}
    >
      <IconPicker
        value={icon}
        recent={recentIcons}
        onSelect={choose}
        onApply={(next) => onIconChange(next)}
        onRemove={() => {
          onIconChange(undefined);
          setPickerOpen(false);
        }}
        onBrowse={iconUpload ? () => run(iconUpload.browse) : undefined}
        onUploadFile={iconUpload ? (f) => run(() => iconUpload.file(f)) : undefined}
        onUploadLink={iconUpload ? (u) => run(() => iconUpload.link(u)) : undefined}
        uploading={upload.busy}
        uploadError={upload.error}
      />
    </PopoverContent>
  );

  return (
    <header data-slot="page-header" className={cn("group/head", className)}>
      {cover ? (
        <div className="group/cover relative">
          {cover.src ? (
            <img
              src={cover.src}
              alt=""
              draggable={false}
              className="block aspect-[4/1] max-h-(--cover-max-h) w-full object-cover"
            />
          ) : (
            <div aria-hidden className="aspect-[4/1] max-h-(--cover-max-h) w-full bg-subtle" />
          )}
          <div className="absolute right-4 bottom-3 flex gap-1 opacity-0 transition-opacity duration-(--dur) group-hover/cover:opacity-100 focus-within:opacity-100 force-hover:opacity-100">
            {onChangeCover ? (
              <Button
                variant="secondary"
                size="sm"
                className="shadow-popover"
                onClick={onChangeCover}
              >
                커버 변경
              </Button>
            ) : null}
            {onRemoveCover ? (
              <Button
                variant="secondary"
                size="sm"
                className="shadow-popover"
                onClick={onRemoveCover}
              >
                커버 제거
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "relative mx-auto w-full px-12",
          wide ? "max-w-full px-16" : "max-w-(--content-w)",
          cover ? "pt-4" : "pt-8",
        )}
      >
        {aside ? (
          <div
            data-slot="page-header-aside"
            className={cn("pointer-events-none absolute left-full ml-6", cover ? "top-4" : "top-8")}
          >
            {aside}
          </div>
        ) : null}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          {icon ? (
            <PopoverTrigger
              aria-label="페이지 아이콘 바꾸기"
              onClick={() => setPickerFrom("icon")}
              className={cn(
                "inline-block rounded-lg p-1 text-page-icon transition-colors duration-(--dur-fast) hover:bg-hover force-hover:bg-hover",
                focusRing,
              )}
            >
              <PageIcon icon={icon} className="block" />
            </PopoverTrigger>
          ) : null}
          {pickerOpen && pickerFrom === "icon" ? picker : null}

          {/* 제목 줄(h1) 안에 편집 칸을 둔다 — h1에는 textbox 역할을 줄 수 없다. 포커스 표시는 캐럿(본문 편집 칸과 같음) */}
          <h1 className="mt-2 text-title font-bold tracking-(--tracking-display) break-words text-primary">
            <span
              ref={titleRef}
              contentEditable="plaintext-only"
              suppressContentEditableWarning
              role="textbox"
              aria-label="페이지 제목"
              aria-multiline={false}
              spellCheck={false}
              data-placeholder={placeholder}
              data-empty={!title || undefined}
              onInput={(e) => onTitleChange(e.currentTarget.textContent ?? "")}
              onKeyDown={(e) => {
                // WebKit은 조합을 끝내는 Enter를 isComposing=false, keyCode 229로 보낸다
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === "Enter" || (e.key === "ArrowDown" && isCaretAtEnd(e.currentTarget))) {
                  e.preventDefault();
                  onTitleExit?.();
                }
              }}
              onPaste={(e) => {
                // 여러 줄을 붙여 넣어도 제목은 한 줄로
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain").replace(/\s*\n+\s*/g, " ");
                document.execCommand("insertText", false, text);
              }}
              className={cn(
                "block w-full outline-none",
                "data-empty:before:pointer-events-none data-empty:before:text-tertiary data-empty:before:content-[attr(data-placeholder)]",
              )}
            ></span>
          </h1>

          <div className="mt-4 flex flex-wrap gap-2 opacity-0 transition-opacity duration-(--dur) group-hover/head:opacity-100 focus-within:opacity-100 force-hover:opacity-100">
            {!cover && onAddCover ? (
              <Button variant="ghost" size="sm" onClick={onAddCover}>
                <ImagePlus strokeWidth={1.5} aria-hidden />
                커버 추가
              </Button>
            ) : null}
            {!icon ? (
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setPickerFrom("action")}>
                  <SmilePlus strokeWidth={1.5} aria-hidden />
                  아이콘 추가
                </Button>
              </PopoverTrigger>
            ) : null}
            {onOpenTemplates ? (
              <Button variant="ghost" size="sm" onClick={onOpenTemplates}>
                <LayoutTemplate strokeWidth={1.5} aria-hidden />
                템플릿
              </Button>
            ) : null}
          </div>
          {pickerOpen && pickerFrom === "action" ? picker : null}
        </Popover>

        {children}
        <div aria-hidden className="mt-6 mb-4 h-px bg-line" />
      </div>
    </header>
  );
}

function isCaretAtEnd(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || !sel.anchorNode) return false;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.setStart(sel.anchorNode, sel.anchorOffset);
  return range.toString().length === 0;
}

export { PageHeader, type IconUpload, type PageHeaderProps };
