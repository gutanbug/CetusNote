import { parsePageIcon } from "@/lib/page-icon";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";
import * as React from "react";
import { iconColorClass, PAGE_ICONS } from "./page-icon-set";

/** 저장 경로(`assets/…`) → 그릴 주소. 화면이 `PageIconProvider`로 준다 */
type ResolveImage = (path: string) => Promise<string>;
const ResolveImageContext = React.createContext<ResolveImage | null>(null);

function PageIconProvider({
  resolveImage,
  children,
}: {
  resolveImage: ResolveImage;
  children: React.ReactNode;
}) {
  return (
    <ResolveImageContext.Provider value={resolveImage}>{children}</ResolveImageContext.Provider>
  );
}

/** 이미지 아이콘 (불러오는 중이면 같은 자리에 옅은 바탕) */
function ImageIcon({ path, className }: { path: string; className?: string }) {
  const resolve = React.useContext(ResolveImageContext);
  const [loaded, setLoaded] = React.useState<{ path: string; src: string | null }>();
  React.useEffect(() => {
    if (!resolve) return;
    let alive = true;
    resolve(path).then(
      (src) => alive && setLoaded({ path, src }),
      // 못 읽으면(지워진 파일 등) 빈 칸 대신 "이미지 없음" 표시
      () => alive && setLoaded({ path, src: null }),
    );
    return () => {
      alive = false;
    };
  }, [path, resolve]);
  const src = loaded?.path === path ? loaded.src : undefined;
  if (src === null)
    return (
      <ImageOff
        strokeWidth={1.5}
        className={cn("inline-block size-[1em] shrink-0 align-[-0.125em] text-tertiary", className)}
      />
    );
  const box = "inline-block size-[1em] shrink-0 rounded-xs align-[-0.125em]";
  return src ? (
    <img src={src} alt="" draggable={false} className={cn(box, "object-cover", className)} />
  ) : (
    <span className={cn(box, "bg-subtle", className)} />
  );
}

type PageIconProps = {
  /** `page.icon` 값 (이모지 · `lucide:…` · `image:…`) */
  icon: string;
  className?: string;
};

/**
 * UI-PageIcon — 페이지 아이콘 하나를 글자 크기(1em)에 맞춰 그린다(PAGE-10).
 * 장식이라 읽어 주지 않는다(aria-hidden). 이름은 옆의 제목이 맡는다.
 */
function PageIcon({ icon, className }: PageIconProps) {
  const v = parsePageIcon(icon);
  if (!v) return null;
  if (v.kind === "image")
    return (
      <span data-slot="page-icon" aria-hidden className="inline-flex">
        <ImageIcon path={v.path} className={className} />
      </span>
    );
  if (v.kind === "icon") {
    const entry = PAGE_ICONS.get(v.name);
    if (!entry) return null;
    return (
      <entry.Icon
        data-slot="page-icon"
        aria-hidden
        strokeWidth={1.5}
        className={cn(
          "inline-block size-[1em] shrink-0 align-[-0.125em]",
          iconColorClass(v.color),
          className,
        )}
      />
    );
  }
  return (
    <span data-slot="page-icon" aria-hidden className={className}>
      {v.emoji}
    </span>
  );
}

export { PageIcon, PageIconProvider, type PageIconProps, type ResolveImage };
