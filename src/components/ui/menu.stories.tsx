import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Copy,
  Ellipsis,
  FolderInput,
  Link,
  MoveHorizontal,
  PenLine,
  Star,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { IconButton } from "./icon-button";
import { Kbd } from "./kbd";

const meta = {
  title: "L2 오버레이/OV-Menu",
  component: DropdownMenuContent,
} satisfies Meta<typeof DropdownMenuContent>;
export default meta;
type Story = StoryObj<typeof meta>;

const ic = { strokeWidth: 1.5 } as const;

function PageMenuItems() {
  return (
    <>
      <DropdownMenuLabel>페이지</DropdownMenuLabel>
      <DropdownMenuItem icon={<Star {...ic} />}>즐겨찾기에 추가</DropdownMenuItem>
      <DropdownMenuItem icon={<Copy {...ic} />} shortcut={<Kbd keys={["⌘", "D"]} />}>
        복제
      </DropdownMenuItem>
      <DropdownMenuItem icon={<PenLine {...ic} />} shortcut={<Kbd keys={["⌘", "⇧", "R"]} />}>
        이름 바꾸기
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger icon={<FolderInput {...ic} />}>옮기기</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem>개인</DropdownMenuItem>
          <DropdownMenuItem>업무</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem icon={<Link {...ic} />} disabled>
        링크 복사
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem checked>전체 폭</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={false}>작은 글꼴</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked icon={<MoveHorizontal {...ic} />}>
        아이콘과 함께
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="danger" icon={<Trash2 {...ic} />} shortcut={<Kbd keys={["⌫"]} />}>
        휴지통으로 이동
      </DropdownMenuItem>
    </>
  );
}

/** 열린 상태 — 아이콘·라벨·단축키, 하위 메뉴, 그룹 라벨, 비활성, 체크, danger (시트 §5) */
export const Open: Story = {
  render: () => (
    <div className="h-110">
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton label="페이지 메뉴" noTooltip>
            <Ellipsis {...ic} />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <PageMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

/** 버튼 클릭 → 화살표 키로 이동, Enter로 선택, Esc로 닫기 */
export const Interactive: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="페이지 메뉴" noTooltip>
          <Ellipsis {...ic} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <PageMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/** 영역을 우클릭하면 열린다 */
export const Context: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="grid h-32 w-72 place-items-center rounded-lg border border-dashed border-line-strong text-caption text-tertiary">
        여기를 우클릭
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem icon={<Copy {...ic} />}>복제</ContextMenuItem>
        <ContextMenuItem icon={<PenLine {...ic} />}>이름 바꾸기</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="danger" icon={<Trash2 {...ic} />}>
          휴지통으로 이동
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};
