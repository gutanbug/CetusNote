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
import { pageMenuSections } from "./page-menu-model";
import { useMainUi } from "./ui-store";
import { useMessages } from "@/lib/i18n";

const ic = { strokeWidth: 1.5 } as const;
const FONT_VALUES: PageFont[] = ["default", "serif", "mono"];

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
  const m = useMessages();
  const fonts = FONT_VALUES.map((value) => ({ value, label: m.screens.pageMenu.fonts[value] }));
  const { update } = pagesStore.getState();
  const structure = usePages((s) => s.structure);
  const defaultWide = useSession((s) => s.appearance.defaultWide);
  // 전체 폭 칸은 실제로 쓰이는 값을 보여 준다. 따로 정한 값이 있으면 상속으로 되돌리는 줄을 더한다
  const body = resolveBodyWidth(page.id, structure, defaultWide);
  const inherited = inheritedBodyWidth(page.id, structure, defaultWide);
  // 컬렉션(COLL-01)은 본문 모양·복제·내보내기가 없다
  const { doc, csv } = pageMenuSections(page.kind);
  // 템플릿(PAGE-14)은 즐겨찾기·탭·링크·옮기기·내보내기가 없다
  if (page.template)
    return (
      <>
        <DropdownMenuItem icon={<Copy {...ic} />} onSelect={() => duplicateTemplate(page.id)}>
          {m.screens.pageMenu.templateDuplicate}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="danger"
          icon={<Trash2 {...ic} />}
          onSelect={() => deleteTemplate(page.id)}
        >
          {m.screens.pageMenu.templateDelete}
        </DropdownMenuItem>
      </>
    );
  return (
    <>
      <DropdownMenuItem
        icon={favorite ? <StarOff {...ic} /> : <Star {...ic} />}
        onSelect={() => toggleFavorite(page.id)}
      >
        {favorite ? m.screens.pageMenu.favoriteRemove : m.screens.pageMenu.favoriteAdd}
      </DropdownMenuItem>
      <DropdownMenuItem icon={<SquarePlus {...ic} />} onSelect={() => openInNewTab(page.id)}>
        {m.screens.pageMenu.openInNewTab}
      </DropdownMenuItem>
      <DropdownMenuItem icon={<Link {...ic} />} onSelect={() => void copyPageLink(page.id)}>
        {m.screens.pageMenu.copyLink}
      </DropdownMenuItem>
      {doc ? (
        <DropdownMenuItem
          icon={<Copy {...ic} />}
          shortcut={<Kbd keys={["⌘", "D"]} />}
          onSelect={() => duplicatePage(page.id)}
        >
          {m.screens.pageMenu.duplicate}
        </DropdownMenuItem>
      ) : null}
      {doc ? (
        <DropdownMenuItem
          icon={<LayoutTemplate {...ic} />}
          onSelect={() => saveAsTemplate(page.id)}
        >
          {m.screens.pageMenu.saveTemplate}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem icon={<FolderInput {...ic} />} onSelect={onMove}>
        {m.screens.pageMenu.move}
      </DropdownMenuItem>
      {doc ? (
        <DropdownMenuItem
          icon={<History {...ic} />}
          onSelect={() => useMainUi.getState().setHistoryPageId(page.id)}
        >
          {m.screens.pageMenu.history}
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
            {m.screens.pageMenu.fullWidth}
          </DropdownMenuCheckboxItem>
          {page.layout.width ? (
            <DropdownMenuItem
              icon={<RotateCcw {...ic} />}
              onSelect={() => setBodyWidth(page.id, undefined)}
            >
              {inherited.from === "folder"
                ? m.screens.pageMenu.followFolder
                : m.screens.pageMenu.followDefault}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger icon={<Type {...ic} />}>
              {m.screens.pageMenu.font}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {fonts.map((f) => (
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
            {m.screens.pageMenu.exportMd}
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Printer {...ic} />} onSelect={() => void exportPdf(page.id)}>
            {m.screens.pageMenu.exportPdf}
          </DropdownMenuItem>
        </>
      ) : null}
      {csv ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<FileSpreadsheet {...ic} />}>
            {m.screens.pageMenu.exportCsv}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => void exportCsv(page.id, "view")}>
              {m.screens.pageMenu.csvView}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportCsv(page.id, "all")}>
              {m.screens.pageMenu.csvAll}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
      {doc ? (
        <>
          <DropdownMenuSeparator />
          {/* 글자 수·읽는 시간 (PAGE-11) — 누를 수 없는 정보 줄 */}
          {/* 머리글(라벨) + 값 — 메뉴 항목처럼 보이지 않게 흐린 글자로 */}
          <DropdownMenuLabel className="grid gap-0.5 font-normal tracking-normal tabular-nums">
            <span className="text-label font-semibold tracking-(--tracking-label) text-tertiary">
              {m.screens.pageMenu.docInfo}
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
        {m.screens.pageMenu.trash}
      </DropdownMenuItem>
    </>
  );
}
