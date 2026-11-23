import { NoteEditor } from "@/components/editor/note-editor";
import { PageTree } from "@/components/shell/page-tree";
import { SaveStatus } from "@/components/shell/save-status";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { exportPageMarkdown, pageToMarkdown } from "@/features/export";
import { pagesStore, usePages } from "@/features/pages";
import { buildPageTree } from "@/features/pages/tree";
import { searchIndex, type SearchResult } from "@/features/search";
import { useWorkspace, workspaceStore } from "@/features/workspace";
import { isTauri } from "@/lib/storage/default";
import { cn } from "@/lib/utils";
import type { JSONContent } from "@tiptap/core";
import { FilePlus, PenLine, Trash2 } from "lucide-react";
import type * as React from "react";
import { useMemo, useState } from "react";

/**
 * 저장 실험 (Debug 화면 전용, Phase 5) — 화면 조립(Phase 6) 전에 저장 계층을 끝까지 확인한다.
 * Tauri 창에서는 실제 워크스페이스 폴더에, 브라우저 미리보기에서는 메모리에 쓴다.
 */
export function StorageLab() {
  const phase = useWorkspace((s) => s.phase);
  const workspace = useWorkspace((s) => s.workspace);
  const busy = useWorkspace((s) => s.busy);
  const pages = usePages((s) => s.pages);
  const loadErrors = usePages((s) => s.loadErrors);
  const saveState = usePages((s) => s.saveState);
  const [selected, setSelected] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  // pages가 바뀌면 다시 찾는다(인덱스는 스토어를 따라 이미 최신)
  const results = useMemo(
    () => (pages && query ? searchIndex.search(query, { limit: 8 }) : []),
    [pages, query],
  );
  const { create, update, trash, restore, purge, flushPage, retry } = pagesStore.getState();

  const tree = useMemo(() => buildPageTree(Object.values(pages)), [pages]);
  const trashed = Object.values(pages)
    .filter((p) => p.trashedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const page = selected ? pages[selected] : undefined;
  const isFolder = page?.kind === "folder";
  const addInside = (parentId: string) => {
    setExpanded((e) => (e.includes(parentId) ? e : [...e, parentId]));
    select(create({ title: "", parentId }).id);
  };

  const select = (id: string | null) => {
    if (selected && selected !== id) void flushPage(selected); // 페이지를 떠날 때 바로 저장
    setSelected(id);
  };

  if (phase !== "ready" || !workspace) {
    return (
      <div className="grid justify-items-start gap-3 text-ui text-secondary">
        <p>워크스페이스가 열려 있지 않아요.{isTauri() ? " 고르면 실제 폴더에 저장돼요." : ""}</p>
        <div className="flex gap-2">
          <Button
            loading={busy === "default"}
            onClick={() => void workspaceStore.getState().openDefault()}
          >
            기본 위치에 만들기
          </Button>
          <Button
            variant="secondary"
            loading={busy === "pick"}
            onClick={() => void workspaceStore.getState().pick()}
          >
            다른 폴더 선택…
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-slot="storage-lab" className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 text-caption text-secondary">
        <span>
          {isTauri() ? "폴더" : "메모리"}: <span className="font-mono">{workspace.path}</span>
        </span>
        <SaveStatus state={saveState} onRetry={() => void retry()} />
        {loadErrors.length ? (
          <span role="status" className="text-danger">
            읽지 못한 파일 {loadErrors.length}개: {loadErrors.map((e) => e.file).join(", ")}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-[14rem_1fr] gap-4">
        <div className="grid content-start gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => select(create({ title: "" }).id)}>
              새 페이지
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => select(create({ kind: "folder", title: "새 폴더" }).id)}
            >
              새 폴더
            </Button>
          </div>
          <SearchInput
            aria-label="페이지 검색"
            placeholder="검색"
            value={query}
            onValueChange={setQuery}
          />
          {query ? (
            <ul aria-label="검색 결과" data-slot="search-results" className="grid gap-1">
              {results.length ? (
                results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => select(r.id)}
                      className="grid w-full gap-0.5 rounded-md px-2 py-1 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent force-hover:bg-hover"
                    >
                      <span className="truncate text-ui text-primary">
                        {r.title || "제목 없음"}
                      </span>
                      <Snippet result={r} />
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-2 text-caption text-tertiary">찾는 페이지가 없어요.</li>
              )}
            </ul>
          ) : null}
          <PageTree
            label="저장 실험 페이지"
            pages={tree}
            activeId={selected ?? undefined}
            expanded={expanded}
            onExpandedChange={setExpanded}
            onOpen={select}
            onAddChild={addInside}
            rowMenu={(node) => (
              <>
                <DropdownMenuItem
                  icon={<FilePlus strokeWidth={1.5} />}
                  onSelect={() => addInside(node.id)}
                >
                  {node.kind === "folder" ? "폴더에 페이지 추가" : "하위 페이지 추가"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<PenLine strokeWidth={1.5} />}
                  onSelect={() => select(node.id)}
                >
                  이름 바꾸기
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<Trash2 strokeWidth={1.5} />}
                  onSelect={() => trash(node.id)}
                >
                  휴지통으로
                </DropdownMenuItem>
              </>
            )}
          />
          <ul aria-label="휴지통" className="grid gap-0.5">
            {trashed.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-current={p.id === selected || undefined}
                  onClick={() => select(p.id)}
                  className={cn(
                    "w-full truncate rounded-md px-2 py-1 text-left text-ui hover:bg-hover aria-[current]:bg-active force-hover:bg-hover",
                    "focus-visible:outline-2 focus-visible:outline-accent",
                    p.trashedAt && "text-tertiary line-through",
                  )}
                >
                  🗑 {p.title || "제목 없음"}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {page ? (
          <div className="grid content-start gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={isFolder ? "폴더 이름" : "제목"}
                value={page.title}
                placeholder={isFolder ? "이름 없는 폴더" : "제목 없음"}
                onChange={(e) => update(page.id, { title: e.target.value })}
                className="max-w-80"
              />
              {page.trashedAt ? (
                <>
                  <Button variant="secondary" onClick={() => restore(page.id)}>
                    복원
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => void purge(page.id).then(() => setSelected(null))}
                  >
                    영구 삭제
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => trash(page.id)}>
                  휴지통으로
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={isFolder}
                onClick={() =>
                  void exportPageMarkdown(page).then(
                    (name) =>
                      setExported(name ? `“${name}”로 내보냈어요.` : "내보내기를 취소했어요."),
                    () => setExported("내보내지 못했어요."),
                  )
                }
              >
                Markdown 내보내기
              </Button>
              {exported ? (
                <span role="status" className="text-caption text-secondary">
                  {exported}
                </span>
              ) : null}
            </div>
            {isFolder ? (
              <p className="text-ui text-tertiary">
                폴더는 본문이 없어요. 트리에서 이름을 누르면 펼치고 접혀요.
              </p>
            ) : (
              <div className="rounded-xl border border-line bg-app px-6 py-6">
                <NoteEditor
                  key={page.id}
                  content={page.content as JSONContent}
                  label="저장 실험 본문"
                  onChange={(content) =>
                    update(page.id, { content: content as typeof page.content })
                  }
                />
              </div>
            )}
            <details className="text-caption text-secondary">
              <summary className="cursor-default">Markdown 미리보기</summary>
              <pre
                data-slot="markdown-preview"
                className="mt-2 overflow-x-auto rounded-md bg-subtle p-3 font-mono text-label whitespace-pre-wrap text-primary"
              >
                {pageToMarkdown(page)}
              </pre>
            </details>
          </div>
        ) : (
          <p className="text-ui text-tertiary">왼쪽에서 페이지를 고르거나 새로 만들어요.</p>
        )}
      </div>
    </div>
  );
}

/** 발췌문 + 맞은 곳 강조 */
function Snippet({ result }: { result: SearchResult }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  result.highlights.forEach(([a, b], i) => {
    if (a < at) return;
    parts.push(result.snippet.slice(at, a));
    parts.push(
      <mark key={i} className="rounded-xs bg-accent-soft text-primary">
        {result.snippet.slice(a, b)}
      </mark>,
    );
    at = b;
  });
  parts.push(result.snippet.slice(at));
  return <span className="line-clamp-2 text-caption text-secondary">{parts}</span>;
}
