import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { usePages } from "@/features/pages";
import { FileText, Folder, House, Table2 } from "lucide-react";
import * as React from "react";
import { useRestoreFocus } from "./use-restore-focus";
import { movePage, moveTargets, displayTitle } from "./actions";
import { pagePath } from "./palette-model";

const ic = { strokeWidth: 1.5 } as const;

/** 옮기기 (PAGE-05) — 갈 수 있는 곳만 보인다(컬렉션 아래에는 문서만 간다) */
export function MoveDialog({
  pageId,
  onOpenChange,
}: {
  pageId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const pages = usePages((s) => s.pages);
  const [query, setQuery] = React.useState("");
  useRestoreFocus(!!pageId);
  const q = query.trim().normalize("NFC").toLowerCase();
  const targets = React.useMemo(
    () => (pageId ? moveTargets(pageId) : []),
    // pages가 바뀌면 다시 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageId, pages],
  );
  const shown = targets.filter(
    (t) => !q || (t ? displayTitle(t) : "맨 위").normalize("NFC").toLowerCase().includes(q),
  );

  return (
    <CommandDialog
      open={!!pageId}
      onOpenChange={(o) => {
        if (!o) setQuery("");
        onOpenChange(o);
      }}
      title="옮길 곳"
      label="옮길 곳"
      shouldFilter={false}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="옮길 폴더나 페이지 검색"
        aria-label="옮길 곳 검색"
      />
      <CommandList>
        <CommandEmpty>옮길 수 있는 곳이 없어요.</CommandEmpty>
        {shown.length ? (
          <CommandGroup heading="옮길 곳">
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
                  if (pageId) movePage(pageId, t?.id ?? null);
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
