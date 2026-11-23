import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Page } from "@/lib/storage";
import { FileText, Folder, House, Table2 } from "lucide-react";
import * as React from "react";
import { displayTitle } from "./actions";
import { pagePath } from "./palette-model";
import { useRestoreFocus } from "./use-restore-focus";

const ic = { strokeWidth: 1.5 } as const;

/**
 * 위치 고르기 대화상자 — 옮기기(PAGE-05)와 Markdown 가져오기 목적지(DATA-08)가 같이 쓴다.
 * targets는 고를 수 있는 곳만 받는다. null은 맨 위(워크스페이스 최상위).
 */
export function ParentPicker({
  open,
  onOpenChange,
  title,
  heading,
  placeholder,
  emptyText,
  pages,
  targets,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 화면 낭독용 제목 */
  title: string;
  /** 보이는 목록 그룹 제목 */
  heading: string;
  placeholder: string;
  emptyText: string;
  pages: Record<string, Page>;
  targets: (Page | null)[];
  onPick: (parentId: string | null) => void;
}) {
  const [query, setQuery] = React.useState("");
  useRestoreFocus(open);
  const q = query.trim().normalize("NFC").toLowerCase();
  const shown = targets.filter(
    (t) => !q || (t ? displayTitle(t) : "맨 위").normalize("NFC").toLowerCase().includes(q),
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setQuery("");
        onOpenChange(o);
      }}
      title={title}
      label={title}
      shouldFilter={false}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={placeholder}
        aria-label={`${heading} 검색`}
      />
      <CommandList>
        <CommandEmpty>{emptyText}</CommandEmpty>
        {shown.length ? (
          <CommandGroup heading={heading}>
            {shown.map((t) => (
              <CommandItem
                key={t?.id ?? "root"}
                value={t?.id ?? "root"}
                icon={
                  !t ? (
                    <House {...ic} />
                  ) : t.kind === "folder" ? (
                    <Folder {...ic} />
                  ) : t.kind === "collection" ? (
                    <Table2 {...ic} />
                  ) : (
                    <FileText {...ic} />
                  )
                }
                description={t ? pagePath(t, pages) || undefined : undefined}
                onSelect={() => {
                  onPick(t?.id ?? null);
                  setQuery("");
                  onOpenChange(false);
                }}
              >
                {t ? displayTitle(t) : "맨 위"}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
