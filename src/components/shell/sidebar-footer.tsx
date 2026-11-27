import { useMessages } from "@/lib/i18n";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type * as React from "react";
import { SaveStatus, type SaveState } from "./save-status";
import { SidebarItem } from "./sidebar-item";

type SidebarFooterProps = {
  trashCount: number;
  onOpenTrash: () => void;
  saveState: SaveState;
  onRetrySave?: () => void;
  /** 휴지통 위에 더할 항목 (빠른 메모 등, P1) */
  children?: React.ReactNode;
  className?: string;
};

/** SH-SidebarFooter — 아래 고정: 휴지통 + 저장 상태 (프로토타입 `.sidebar-foot`). */
function SidebarFooter({
  trashCount,
  onOpenTrash,
  saveState,
  onRetrySave,
  children,
  className,
}: SidebarFooterProps) {
  const m = useMessages();
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("grid grid-cols-1 gap-0.5 border-t border-line p-2", className)}
    >
      {children}
      <SidebarItem
        icon={Trash2}
        label={m.shell.sidebar.trash}
        count={trashCount}
        aria-haspopup="dialog"
        onClick={onOpenTrash}
      />
      <SaveStatus state={saveState} onRetry={onRetrySave} />
    </div>
  );
}

export { SidebarFooter, type SidebarFooterProps };
