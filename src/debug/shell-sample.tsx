import {
  Clock,
  Copy,
  FilePlus,
  FolderPlus,
  House,
  LayoutTemplate,
  Link,
  PenLine,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { Breadcrumb } from "@/components/shell/breadcrumb";
import { PageTree, type PageNode } from "@/components/shell/page-tree";
import { SAMPLE_PAGES, SAMPLE_PATH, SAMPLE_WORKSPACES } from "./shell-data";
import type { SaveState } from "@/components/shell/save-status";
import { Sidebar } from "@/components/shell/sidebar";
import { SidebarFooter } from "@/components/shell/sidebar-footer";
import { SidebarItem } from "@/components/shell/sidebar-item";
import { SidebarSection } from "@/components/shell/sidebar-section";
import { TopBar } from "@/components/shell/top-bar";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";

// L3 셸 스토리가 함께 쓰는 견본 데이터와 조립 예. 화면(screens/)은 쓰지 않는다.

const ic = { strokeWidth: 1.5 } as const;

export function RowMenu({ node }: { node: PageNode }) {
  return (
    <>
      <DropdownMenuItem icon={<Star {...ic} />}>즐겨찾기에 추가</DropdownMenuItem>
      <DropdownMenuItem icon={<Plus {...ic} />}>하위 페이지 추가</DropdownMenuItem>
      <DropdownMenuItem icon={<PenLine {...ic} />} shortcut={<Kbd keys={["⌘", "⇧", "R"]} />}>
        이름 바꾸기
      </DropdownMenuItem>
      <DropdownMenuItem icon={<Copy {...ic} />} shortcut={<Kbd keys={["⌘", "D"]} />}>
        복제
      </DropdownMenuItem>
      <DropdownMenuItem icon={<Link {...ic} />}>링크 복사</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="danger" icon={<Trash2 {...ic} />}>
        “{node.title || "제목 없음"}” 휴지통으로
      </DropdownMenuItem>
    </>
  );
}

export function WorkspaceMenu() {
  return (
    <>
      <DropdownMenuItem icon={<Settings {...ic} />} shortcut={<Kbd keys={["⌘", ","]} />}>
        설정
      </DropdownMenuItem>
      <DropdownMenuItem icon={<Search {...ic} />}>Finder에서 보기</DropdownMenuItem>
    </>
  );
}

/** 사이드바 전체 조립 — 상태를 스스로 들고 있어 그대로 만져 볼 수 있다 */
export function SidebarSpecimen({
  saveState = "saved",
  collapsed = false,
  initialActive = "m-1118",
  titleBarInset = false,
}: {
  saveState?: SaveState;
  collapsed?: boolean;
  initialActive?: string;
  titleBarInset?: boolean;
}) {
  const [active, setActive] = React.useState(initialActive);
  const [expanded, setExpanded] = React.useState(["work", "meetings"]);
  const [width, setWidth] = React.useState(240);
  return (
    <div className="flex h-150 rounded-lg border border-line">
      <Sidebar
        collapsed={collapsed}
        titleBarInset={titleBarInset}
        width={width}
        onWidthChange={setWidth}
        onWidthReset={() => setWidth(240)}
        header={
          <WorkspaceSwitcher
            name="내 노트"
            workspaces={SAMPLE_WORKSPACES}
            onCreate={() => {}}
            onOpenFolder={() => {}}
          >
            <WorkspaceMenu />
          </WorkspaceSwitcher>
        }
        footer={
          <SidebarFooter
            trashCount={3}
            onOpenTrash={() => {}}
            saveState={saveState}
            onRetrySave={() => {}}
          />
        }
      >
        <SidebarSection title="빠른 액션" untitled>
          <SidebarItem icon={House} label="홈" />
          <SidebarItem icon={Search} label="검색" shortcut={["⌘", "K"]} />
          <SidebarItem icon={Clock} label="최근 항목" />
          <SidebarItem icon={Plus} label="새 페이지" shortcut={["⌘", "N"]} />
          <SidebarItem icon={LayoutTemplate} label="템플릿" />
        </SidebarSection>
        <SidebarSection title="즐겨찾기">
          <SidebarItem emoji="🧭" label="2027 상반기 로드맵" />
        </SidebarSection>
        <SidebarSection
          title="문서"
          action={{
            label: "추가",
            icon: Plus,
            menu: (
              <>
                <DropdownMenuItem icon={<FilePlus {...ic} />} shortcut={<Kbd keys={["⌘", "N"]} />}>
                  새 페이지
                </DropdownMenuItem>
                <DropdownMenuItem icon={<FolderPlus {...ic} />}>새 폴더</DropdownMenuItem>
              </>
            ),
          }}
        >
          <PageTree
            pages={SAMPLE_PAGES}
            activeId={active}
            expanded={expanded}
            onExpandedChange={setExpanded}
            onOpen={setActive}
            onAddChild={() => {}}
            rowMenu={(node) => <RowMenu node={node} />}
          />
        </SidebarSection>
      </Sidebar>
      <div className="min-w-0 flex-1 bg-app">
        <TopBar
          breadcrumb={<Breadcrumb items={SAMPLE_PATH} />}
          editedAt="3분 전 편집"
          onToggleSidebar={() => {}}
          onToggleFavorite={() => {}}
        />
        <div className="mt-4 w-80 border-l border-line bg-app">
          <TopBar
            variant="pane"
            pane={{
              icon: "📝",
              title: "주간 회의록",
              onOpenMain: () => {},
              onSwap: () => {},
              onClose: () => {},
            }}
          />
        </div>
      </div>
    </div>
  );
}
