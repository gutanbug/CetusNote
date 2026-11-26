import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { inheritedBodyWidth, pagesStore, resolveBodyWidth, usePages } from "@/features/pages";
import { useSession } from "@/features/session";
import { docStats, formatDocStats } from "@/features/pages/stats";
import type { Page, PageFont } from "@/lib/storage";
import {
  Copy,
  Download,
  Printer,
  FolderInput,
  RotateCcw,
  History,
  LayoutTemplate,
  Link,
  MoveHorizontal,
  Star,
  StarOff,
  SquarePlus,
  Trash2,
  Type,
  FileSpreadsheet,
} from "lucide-react";
import {
  copyPageLink,
  deleteTemplate,
  duplicatePage,
  duplicateTemplate,
  exportCsv,
  exportMarkdown,
  exportPdf,
  moveToTrash,
  saveAsTemplate,
  setBodyWidth,
  toggleFavorite,
} from "./actions";
import { openInNewTab } from "./tabs";
import { useMainUi } from "./ui-store";

const ic = { strokeWidth: 1.5 } as const;
const FONTS: { value: PageFont; label: string }[] = [
  { value: "default", label: "기본" },
  { value: "serif", label: "세리프" },
  { value: "mono", label: "모노" },
];

/** 상단 바 `···` 페이지 메뉴 (PAGE-05) */
export function PageMenu({
  page,
  favorite,
  onMove,
}: {
  page: Page;
  favorite: boolean;
  onMove: () => void;
}) {
  const { update } = pagesStore.getState();
  const structure = usePages((s) => s.structure);
  const defaultWide = useSession((s) => s.appearance.defaultWide);
  // 전체 폭 칸은 실제로 쓰이는 값을 보여 준다. 따로 정한 값이 있으면 상속으로 되돌리는 줄을 더한다
  const body = resolveBodyWidth(page.id, structure, defaultWide);
  const inherited = inheritedBodyWidth(page.id, structure, defaultWide);
  // 컬렉션(COLL-01)은 본문 모양·복제·내보내기가 없다
  const doc = page.kind === "page";
  // 템플릿(PAGE-14)은 즐겨찾기·탭·링크·옮기기·내보내기가 없다
  if (page.template)
    return (
      <>
        <DropdownMenuItem icon={<Copy {...ic} />} onSelect={() => duplicateTemplate(page.id)}>
          템플릿 복제
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="danger"
          icon={<Trash2 {...ic} />}
          onSelect={() => deleteTemplate(page.id)}
        >
          템플릿 삭제
        </DropdownMenuItem>
      </>
    );
  return (
    <>
      <DropdownMenuItem
        icon={favorite ? <StarOff {...ic} /> : <Star {...ic} />}
        onSelect={() => toggleFavorite(page.id)}
      >
        {favorite ? "즐겨찾기에서 빼기" : "즐겨찾기에 추가"}
      </DropdownMenuItem>
      <DropdownMenuItem icon={<SquarePlus {...ic} />} onSelect={() => openInNewTab(page.id)}>
        새 탭에서 열기
      </DropdownMenuItem>
      <DropdownMenuItem icon={<Link {...ic} />} onSelect={() => void copyPageLink(page.id)}>
        링크 복사
      </DropdownMenuItem>
      {doc ? (
        <DropdownMenuItem
          icon={<Copy {...ic} />}
          shortcut={<Kbd keys={["⌘", "D"]} />}
          onSelect={() => duplicatePage(page.id)}
        >
          복제
        </DropdownMenuItem>
      ) : null}
      {doc ? (
        <DropdownMenuItem
          icon={<LayoutTemplate {...ic} />}
          onSelect={() => saveAsTemplate(page.id)}
        >
          템플릿으로 저장
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem icon={<FolderInput {...ic} />} onSelect={onMove}>
        옮기기…
      </DropdownMenuItem>
      {doc ? (
        <DropdownMenuItem
          icon={<History {...ic} />}
          onSelect={() => useMainUi.getState().setHistoryPageId(page.id)}
        >
          버전 기록…
        </DropdownMenuItem>
      ) : null}
      {doc ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            icon={<MoveHorizontal {...ic} aria-hidden />}
            checked={body.width === "wide"}
            onCheckedChange={(on) => setBodyWidth(page.id, on === true ? "wide" : "default")}
          >
            전체 폭
          </DropdownMenuCheckboxItem>
          {page.layout.width ? (
            <DropdownMenuItem
              icon={<RotateCcw {...ic} />}
              onSelect={() => setBodyWidth(page.id, undefined)}
            >
              {inherited.from === "folder" ? "폴더 설정 따르기" : "기본 설정 따르기"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger icon={<Type {...ic} />}>글꼴</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {FONTS.map((f) => (
                <DropdownMenuCheckboxItem
                  key={f.value}
                  checked={page.layout.font === f.value}
                  onCheckedChange={() =>
                    update(page.id, { layout: { ...page.layout, font: f.value } })
                  }
                >
                  <span
                    className={
                      f.value === "serif"
                        ? "font-serif"
                        : f.value === "mono"
                          ? "font-mono"
                          : undefined
                    }
                  >
                    {f.label}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<Download {...ic} />}
            onSelect={() => void exportMarkdown(page.id)}
          >
            Markdown으로 내보내기
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Printer {...ic} />} onSelect={() => void exportPdf(page.id)}>
            PDF로 내보내기…
          </DropdownMenuItem>
          {page.kind === "collection" && (
            <DropdownMenuItem
              icon={<FileSpreadsheet {...ic} />}
              onSelect={() => void exportCsv(page.id)}
            >
              CSV로 내보내기
            </DropdownMenuItem>
          )}
        </>
      ) : null}
      {doc ? (
        <>
          <DropdownMenuSeparator />
          {/* 글자 수·읽는 시간 (PAGE-11) — 누를 수 없는 정보 줄 */}
          {/* 머리글(라벨) + 값 — 메뉴 항목처럼 보이지 않게 흐린 글자로 */}
          <DropdownMenuLabel className="grid gap-0.5 font-normal tracking-normal tabular-nums">
            <span className="text-label font-semibold tracking-(--tracking-label) text-tertiary">
              글 정보
            </span>
            <span className="text-caption text-secondary">
              {formatDocStats(docStats(page.content))}
            </span>
          </DropdownMenuLabel>
        </>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="danger"
        icon={<Trash2 {...ic} />}
        onSelect={() => moveToTrash(page.id)}
      >
        휴지통으로 옮기기
      </DropdownMenuItem>
    </>
  );
}
