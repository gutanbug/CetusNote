import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ui/tag-chip";
import { useMeta } from "@/features/meta";
import { usePages } from "@/features/pages";
import { cleanTagName, tagExists, tagUsage } from "@/features/tags/manage";
import { isChoseong, toChoseong } from "@/lib/hangul";
import * as React from "react";
import { useRestoreFocus } from "./use-restore-focus";
import { runTagOp } from "./tag-actions";
import { countTags, tagColor } from "./tag-colors";
import { findTagAnchor, useTagUi } from "./tag-ui";

/** 태그 대화상자 묶음 (SHELL-18) — 이름 바꾸기 · 합치기 · 삭제. 한 번만 마운트한다 */
export function TagDialogs() {
  const dialog = useTagUi((s) => s.dialog);
  const close = useTagUi((s) => s.closeDialog);
  // 메뉴 항목에서 열렸다면 메뉴를 연 행으로 돌아간다(메뉴 항목은 대화상자가 열리며 사라진다).
  // 이름을 바꿨다면 새 이름의 행으로 간다 — 예전 행은 새 이름으로 다시 그려져 떨어졌다
  const menu = useTagUi((s) => s.menu);
  const renamedTo = useTagUi((s) => s.renamedTo);
  const returnTo = menu?.returnTo ?? null;
  const scope = menu?.scope ?? null;
  useRestoreFocus(!!dialog, () => (renamedTo ? findTagAnchor(renamedTo, scope) : null) ?? returnTo);
  const onOpenChange = (o: boolean) => !o && close();
  const kind = dialog?.kind;
  const tag = dialog?.tag ?? "";
  return (
    <>
      <RenameTagDialog
        key={kind === "rename" ? `rename:${tag}` : "rename"}
        open={kind === "rename"}
        tag={tag}
        onOpenChange={onOpenChange}
      />
      <MergeTagDialog
        key={kind === "merge" ? `merge:${tag}` : "merge"}
        open={kind === "merge"}
        tag={tag}
        onOpenChange={onOpenChange}
      />
      <DeleteTagDialog
        key={kind === "delete" ? `delete:${tag}` : "delete"}
        open={kind === "delete"}
        tag={tag}
        onOpenChange={onOpenChange}
      />
    </>
  );
}

function RenameTagDialog({
  open,
  tag,
  onOpenChange,
}: {
  open: boolean;
  tag: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = React.useState(tag);
  const pages = usePages((s) => s.pages);
  const clean = cleanTagName(name);
  // 새 이름이 이미 있는 태그면 합치기로 처리한다 — 확인 문구에 그렇게 적는다
  const clash = !!clean && clean !== tag && tagExists(pages, clean);
  const hintId = React.useId();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clean) return;
    if (clean === tag || runTagOp({ kind: "rename", from: tag, to: clean })) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>태그 이름 바꾸기</DialogTitle>
            <DialogDescription>
              {clash
                ? `‘${clean}’ 태그가 이미 있어요. 합칠까요?`
                : "모든 문서에서 이 태그 이름이 바뀌어요."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1">
            <Input
              autoFocus
              aria-label="태그 이름"
              aria-describedby={clean ? undefined : hintId}
              value={name}
              placeholder="태그 이름"
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
            />
            {clean ? null : (
              <p id={hintId} className="text-caption text-secondary">
                이름을 입력해 주세요
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={!clean}>
              {clash ? "태그 합치기" : "이름 바꾸기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MergeTagDialog({
  open,
  tag,
  onOpenChange,
}: {
  open: boolean;
  tag: string;
  onOpenChange: (open: boolean) => void;
}) {
  const pages = usePages((s) => s.pages);
  const colors = useMeta((s) => s.meta?.tags);
  const targets = React.useMemo(
    () =>
      countTags(Object.values(pages).filter((p) => p.kind === "page")).filter(
        ([name]) => name !== tag,
      ),
    [pages, tag],
  );
  // 검색어로 줄이고, ↓/↑로 고르고, Enter로 합친다. 입력은 검색창에 둔다(aria-activedescendant)
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const q = query.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const shown = React.useMemo(
    () => (q ? targets.filter(([name]) => matchTag(name, q)) : targets),
    [targets, q],
  );
  const cur = Math.min(active, Math.max(shown.length - 1, 0));
  const listId = React.useId();
  React.useEffect(() => {
    document.getElementById(`${listId}-${cur}`)?.scrollIntoView?.({ block: "nearest" });
  }, [cur, listId]);
  const pick = (name: string) => {
    if (runTagOp({ kind: "merge", from: tag, into: name })) onOpenChange(false);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중의 Enter는 고르기가 아니다
    if (e.nativeEvent.isComposing || !shown.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((cur + step + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(shown[cur]![0]);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>다른 태그와 합치기</DialogTitle>
          <DialogDescription>
            ‘{tag}’ 태그가 붙은 문서는 고른 태그로 바뀌고, ‘{tag}’ 태그는 없어져요.
          </DialogDescription>
        </DialogHeader>
        {targets.length ? (
          <>
            <Input
              autoFocus
              role="combobox"
              aria-label="합칠 태그 검색"
              aria-expanded={shown.length > 0}
              aria-controls={shown.length ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={shown.length ? `${listId}-${cur}` : undefined}
              placeholder="태그 검색"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
            {shown.length ? (
              <ul
                id={listId}
                role="listbox"
                aria-label="합칠 태그"
                className="grid max-h-72 gap-0.5 overflow-y-auto"
              >
                {shown.map(([name, count], i) => (
                  <li
                    key={name}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === cur}
                    data-slot="merge-target"
                    onClick={() => pick(name)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-ui hover:bg-hover aria-selected:bg-hover force-hover:bg-hover"
                  >
                    <TagChip color={tagColor(colors?.[name])}>{name}</TagChip>
                    <span className="ml-auto text-label text-tertiary tabular-nums">{count}개</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ui text-tertiary">맞는 태그가 없어요</p>
            )}
          </>
        ) : (
          <p className="text-ui text-tertiary">합칠 다른 태그가 없어요.</p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 태그 이름이 검색어(정규화된 소문자)에 맞는지: 글자 그대로 포함, 또는 초성 검색(ㅁㅅ → 문서) */
function matchTag(name: string, q: string): boolean {
  const n = name.normalize("NFC").toLowerCase();
  return n.includes(q) || (isChoseong(q) && toChoseong(n).includes(q));
}

function DeleteTagDialog({
  open,
  tag,
  onOpenChange,
}: {
  open: boolean;
  tag: string;
  onOpenChange: (open: boolean) => void;
}) {
  const pages = usePages((s) => s.pages);
  const n = tagUsage(pages, tag);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>태그 삭제</DialogTitle>
          <DialogDescription>
            {n
              ? `문서 ${n}개에서 ‘${tag}’ 태그를 빼요. 페이지는 지워지지 않아요.`
              : `‘${tag}’ 태그가 붙은 문서는 없어요. 태그 색만 지워져요.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (runTagOp({ kind: "delete", name: tag })) onOpenChange(false);
            }}
          >
            태그 삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
