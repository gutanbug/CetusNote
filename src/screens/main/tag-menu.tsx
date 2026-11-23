import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COLOR_NAMES } from "@/components/ui/color-popover";
import { SOFT_COLORS, type SoftColor } from "@/components/ui/tag-chip";
import { TAG_DOT } from "@/components/shell/tag-dot";
import { useMeta } from "@/features/meta";
import { cn } from "@/lib/utils";
import { GitMerge, Palette, PenLine, Trash2 } from "lucide-react";
import { runTagOp } from "./tag-actions";
import { useTagUi } from "./tag-ui";
import { tagColor } from "./tag-colors";

const ic = { strokeWidth: 1.5 } as const;

/**
 * 태그 메뉴 (SHELL-18) — 이름 바꾸기 · 색 ▸ · 다른 태그와 합치기 · 태그 삭제.
 * 한 번만 그리고, 여는 자리는 useTagUi.openMenu 좌표로 정한다(고정 위치의 빈 기준점에 붙인다).
 */
export function TagMenu() {
  const menu = useTagUi((s) => s.menu);
  const menuOpen = useTagUi((s) => s.menuOpen);
  const closeMenu = useTagUi((s) => s.closeMenu);
  const openDialog = useTagUi((s) => s.openDialog);
  const tag = menu?.tag ?? "";
  const current = useMeta((s) => (tag ? s.meta?.tags[tag] : undefined));
  return (
    <DropdownMenu open={menuOpen} onOpenChange={(o) => !o && closeMenu()}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed size-0"
          style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52"
        onCloseAutoFocus={(e) => {
          // 메뉴 항목이 대화상자를 열었다면 포커스는 대화상자가 가진다(복귀하면 입력이 날아간다)
          if (useTagUi.getState().dialog) {
            e.preventDefault();
            return;
          }
          const el = menu?.returnTo ?? null;
          if (el?.isConnected) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <DropdownMenuItem
          icon={<PenLine {...ic} />}
          onSelect={() => {
            closeMenu();
            openDialog("rename", tag);
          }}
        >
          이름 바꾸기…
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<Palette {...ic} />}>색</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            {SOFT_COLORS.map((c: SoftColor) => (
              <DropdownMenuCheckboxItem
                key={c}
                checked={tagColor(current) === c}
                icon={<span aria-hidden className={cn("size-2 rounded-pill", TAG_DOT[c])} />}
                onSelect={() => {
                  closeMenu();
                  runTagOp({ kind: "recolor", name: tag, color: c });
                }}
              >
                {COLOR_NAMES[c]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          icon={<GitMerge {...ic} />}
          onSelect={() => {
            closeMenu();
            openDialog("merge", tag);
          }}
        >
          다른 태그와 합치기…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="danger"
          icon={<Trash2 {...ic} />}
          onSelect={() => {
            closeMenu();
            openDialog("delete", tag);
          }}
        >
          태그 삭제…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
